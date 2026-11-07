"""Safety constraints for the metadata-audit collector; no DB needed."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import unittest
from unittest.mock import patch

MODULE = Path(__file__).with_name("rls-metadata-audit.py")
SPEC = importlib.util.spec_from_file_location("rls_metadata_audit", MODULE)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)

CONNECTION = "postgresql://audit:p%3Aa%5Css@127.0.0.1:55437/disposable?sslmode=disable"
ENV = {"RLS_AUDIT_DATABASE_URL": CONNECTION, "RLS_AUDIT_EXPECTED_ROLE": "audit", "PATH": os.environ["PATH"]}


def report():
    return {
        "format_version": 1, "scope": "system-catalog-metadata-only", "server_version_num": 160000,
        "session": {"transaction_read_only": "on", "identity_matches_expected": True},
        "limits": {"schemas": 32, "relations": 256, "functions": 256, "policies": 256,
                   "membership_edges": 256, "default_acl_rows": 512,
                   "audited_roles": 64, "audited_role_count": 1, "schema_count": 1, "relation_count": 1, "function_count": 1, "policy_count": 1,
                   "membership_edge_count": 0, "default_acl_row_count": 0, "oversized_column_relations": 0},
        "roles": [], "role_capabilities": [], "membership_edges": [], "schemas": [], "relations": [], "policies": [], "functions": [], "default_acl": [],
    }


class CarrierSafety(unittest.TestCase):
    def run_main(self, result=None, environment=None, side_effect=None):
        output, errors = io.StringIO(), io.StringIO()
        with patch.dict(os.environ, environment or ENV, clear=True), patch.object(AUDIT.subprocess, "run", return_value=result, side_effect=side_effect) as client:
            with contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
                status = AUDIT.main()
        return status, output.getvalue(), errors.getvalue(), client

    def test_explicit_target_and_secret_stay_out_of_argv_and_child_environment(self):
        path = None
        def client(command, **options):
            nonlocal path
            self.assertFalse(any("postgresql://" in item or "p:a" in item for item in command))
            child = options["env"]
            self.assertNotIn("RLS_AUDIT_DATABASE_URL", child)
            self.assertNotIn("PGPASSWORD", child)
            self.assertEqual((child["PGHOST"], child["PGPORT"], child["PGDATABASE"], child["PGUSER"]), ("127.0.0.1", "55437", "disposable", "audit"))
            self.assertEqual(child["PGSSLMODE"], "disable")
            self.assertEqual(options["stderr"], subprocess.DEVNULL)
            self.assertEqual(options["timeout"], 30)
            path = Path(child["PGPASSFILE"])
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            self.assertEqual(path.read_text(), "127.0.0.1:55437:disposable:audit:p\\:a\\\\ss\n")
            return subprocess.CompletedProcess(command, 0, json.dumps(report()).encode())
        status, output, errors, _ = self.run_main(side_effect=client)
        self.assertEqual(status, 0)
        self.assertTrue(json.loads(output)["complete_within_limits"])
        self.assertEqual(errors, "")
        self.assertFalse(path.exists())

    def test_raw_libpq_error_never_reaches_output(self):
        status, output, errors, _ = self.run_main(result=subprocess.CompletedProcess([], 1, b"", b"sensitive-connection-diagnostics"))
        self.assertEqual(status, 1)
        self.assertEqual(output, "")
        self.assertNotIn("sensitive", errors)
        self.assertEqual(json.loads(errors)["error"], "metadata-query-failed-diagnostics-withheld")

    def test_timeout_and_os_errors_do_not_print_exception_values(self):
        for error, code in [(subprocess.TimeoutExpired("private-command", 30), "metadata-audit-deadline-exceeded"), (OSError("private-target"), "metadata-client-unavailable")]:
            with self.subTest(code=code):
                status, output, errors, _ = self.run_main(side_effect=error)
                self.assertEqual((status, output), (1, ""))
                self.assertEqual(json.loads(errors)["error"], code)
                self.assertNotIn("private", errors)

    def test_invalid_inputs_cannot_connect(self):
        for environment in [{**ENV, "RLS_AUDIT_EXPECTED_ROLE": "bad\nrole"}, {**ENV, "RLS_AUDIT_DATABASE_URL": "postgresql:///fallback"}, {**ENV, "RLS_AUDIT_DATABASE_URL": CONNECTION + "&options=unsafe"}, {**ENV, "RLS_AUDIT_DATABASE_URL": CONNECTION + "&sslmode=require"}, {**ENV, "RLS_AUDIT_DATABASE_URL": CONNECTION + "#ignored"}, {**ENV, "RLS_AUDIT_DATABASE_URL": CONNECTION.replace("127.0.0.1", "host1,host2")}, {**ENV, "RLS_AUDIT_DATABASE_URL": CONNECTION.replace("p%3Aa%5Css", "bad%00value")}, {**ENV, "RLS_AUDIT_DATABASE_URL": CONNECTION.replace(":55437", ":0")}, {**ENV, "RLS_AUDIT_DATABASE_URL": CONNECTION.replace(":55437", ":65536")}]:
            with self.subTest():
                status, output, _errors, client = self.run_main(result=subprocess.CompletedProcess([], 1, b""), environment=environment)
                self.assertEqual((status, output), (1, ""))
                client.assert_not_called()

    def test_incomplete_or_wrong_identity_inventory_is_not_a_pass(self):
        incomplete, wrong_identity = report(), report()
        incomplete["limits"]["relation_count"] = 257
        wrong_identity["session"]["identity_matches_expected"] = False
        for value in [incomplete, wrong_identity]:
            status, output, errors, _ = self.run_main(result=subprocess.CompletedProcess([], 0, json.dumps(value).encode()))
            self.assertEqual(status, 2)
            self.assertEqual(errors, "")
            self.assertIn("complete_within_limits", json.loads(output))

    def test_invalid_or_non_read_only_output_is_withheld(self):
        values = [b"not-json-private-text", json.dumps({**report(), "extra": "private"}).encode()]
        value = report()
        value["session"]["transaction_read_only"] = "off"
        values.append(json.dumps(value).encode())
        for value in values:
            status, output, errors, _ = self.run_main(result=subprocess.CompletedProcess([], 0, value))
            self.assertEqual((status, output), (1, ""))
            self.assertNotIn("private", errors)

    def test_sql_reads_only_catalogs_and_named_ctes_and_cannot_mutate(self):
        sql = MODULE.with_suffix(".sql").read_text()
        self.assertIn("BEGIN READ ONLY;", sql)
        self.assertIn("SET LOCAL statement_timeout = '5s';", sql)
        self.assertIn("SET LOCAL lock_timeout = '1s';", sql)
        self.assertTrue(sql.rstrip().endswith("ROLLBACK;"))
        for forbidden in ["pg_authid", "rolpassword", "rolconfig", "prosrc", "pg_get_functiondef", "pg_get_expr", "\\gexec", "\\i ", "\\!"]:
            self.assertNotIn(forbidden, sql.lower())
        clean = re.sub(r"--[^\n]*", "", sql)
        clean = re.sub(r"'(?:''|[^'])*'", "''", clean)
        self.assertIsNone(re.search(r"\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|EXECUTE|COPY|CALL|DO)\b", clean, re.I))
        allowed_ctes = {"wanted_roles", "subjects", "membership_nodes", "audited_roles", "bounded_memberships", "user_schemas", "relations", "functions", "bounded_default_acl", "policies"}
        allowed_functions = {
            "aclexplode", "array_agg", "convert_to", "current_setting", "encode",
            "has_column_privilege", "has_function_privilege", "has_schema_privilege",
            "has_sequence_privilege", "has_table_privilege", "jsonb_agg", "jsonb_build_object",
            "pg_get_userbyid", "pg_has_role", "row_security_active", "sha256", "unnest",
        }
        for function in re.findall(r"pg_catalog\.(\w+)\s*\(", clean):
            self.assertIn(function, allowed_functions)
        for source in re.findall(r"\b(?:FROM|JOIN)\s+(?:LATERAL\s+)?([\w.]+)", clean, re.I):
            self.assertTrue(source.startswith("pg_catalog.") or source in allowed_ctes, source)


if __name__ == "__main__":
    unittest.main()
