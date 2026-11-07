#!/usr/bin/env python3
"""Run the reviewed catalog-only query; never print connection/raw-error text."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from urllib.parse import parse_qsl, unquote, urlsplit

ROOT_KEYS = {
    "format_version", "scope", "server_version_num", "session", "limits", "roles",
    "membership_edges", "role_capabilities", "schemas", "relations", "policies", "functions", "default_acl",
}


def fail(code: str) -> int:
    # Codes are static, not derived from libpq stderr, exception text, or inputs.
    print(json.dumps({"error": code}), file=sys.stderr)
    return 1


def main() -> int:
    connection = os.environ.get("RLS_AUDIT_DATABASE_URL", "")
    expected = os.environ.get("RLS_AUDIT_EXPECTED_ROLE", "")
    try:
        if not expected or len(expected.encode("utf-8")) > 63 or re.search(r"[\x00-\x1f\x7f]", expected):
            return fail("expected-role-required")
    except UnicodeError:
        return fail("expected-role-required")
    try:
        # urlsplit strips raw tabs/newlines and leading C0/space characters.
        # Reject those bytes before parsing so the configured target cannot
        # silently become a different, normalized connection target.
        if connection != connection.strip() or re.search(r"[\x00-\x20\x7f]", connection):
            return fail("unsupported-connection-value")
        parsed = urlsplit(connection)
        if parsed.scheme not in {"postgres", "postgresql"} or not parsed.hostname or not parsed.username or parsed.password is None or parsed.path in {"", "/"} or parsed.fragment:
            return fail("explicit-database-url-required")
        explicit_port = parsed.port
        if explicit_port is not None and not 1 <= explicit_port <= 65535:
            return fail("invalid-port")
        port = str(5432 if explicit_port is None else explicit_port)
        parameters = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True)
        allowed = {"sslmode": "PGSSLMODE", "channel_binding": "PGCHANNELBINDING", "sslrootcert": "PGSSLROOTCERT"}
        if len(dict(parameters)) != len(parameters) or any(key not in allowed for key, _value in parameters):
            return fail("unsupported-connection-option")
        host = parsed.hostname
        if any(character in host for character in [",", "/", "\\", "%"]):
            return fail("single-tcp-host-required")
        database = unquote(parsed.path[1:], errors="strict")
        user = unquote(parsed.username, errors="strict")
        password = unquote(parsed.password, errors="strict")
        if any(re.search(r"[\x00-\x1f\x7f]", value) for value in [host, database, user, password, *(value for _key, value in parameters)]):
            return fail("unsupported-connection-value")
    except (ValueError, UnicodeError):
        return fail("explicit-database-url-required")
    # Explicit libpq fields avoid URI-in-PGDATABASE fallback behavior. The URL
    # and password stay out of argv and the child environment. Pass only the
    # loader/locale environment needed by psql, never other database credentials,
    # tokens, target selection, service files, or startup options.
    inherited = {"PATH", "LD_LIBRARY_PATH", "LANG", "LC_ALL", "LC_CTYPE"}
    env = {key: value for key, value in os.environ.items() if key in inherited}
    env.update({
        "PGHOST": host, "PGPORT": port, "PGDATABASE": database, "PGUSER": user,
        "PGCONNECT_TIMEOUT": "10", "PGAPPNAME": "life-ustc-rls-metadata-audit",
        "PGSERVICEFILE": os.devnull,
    })
    env.update({allowed[key]: value for key, value in parameters})
    sql = Path(__file__).with_suffix(".sql")
    command = ["psql", "--no-psqlrc", "--no-password", "--quiet", "--no-align", "--tuples-only", "--set", "ON_ERROR_STOP=1", "--set", f"expected_role={expected}", "--file", str(sql)]
    try:
        with tempfile.TemporaryDirectory(prefix="life-ustc-rls-audit-") as directory:
            passfile = Path(directory) / "pgpass"
            escape = lambda value: value.replace("\\", "\\\\").replace(":", "\\:")
            with passfile.open("x", encoding="utf-8") as handle:
                passfile.chmod(0o600)
                handle.write(":".join(map(escape, [host, port, database, user, password])) + "\n")
            env["PGPASSFILE"] = str(passfile)
            result = subprocess.run(command, env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=30, check=False)
    except subprocess.TimeoutExpired:
        return fail("metadata-audit-deadline-exceeded")
    except OSError:
        return fail("metadata-client-unavailable")
    if result.returncode:
        return fail("metadata-query-failed-diagnostics-withheld")
    if len(result.stdout) > 4 * 1024 * 1024:
        return fail("metadata-report-too-large")
    try:
        report = json.loads(result.stdout)
        if not isinstance(report, dict) or set(report) != ROOT_KEYS:
            return fail("unexpected-metadata-shape")
        if report["scope"] != "system-catalog-metadata-only" or report["format_version"] != 1:
            return fail("unexpected-metadata-scope")
        if report["server_version_num"] < 160000 or report["session"]["transaction_read_only"] != "on":
            return fail("read-only-pg16-required")
        limits = report["limits"]
        complete = all(limits[f"{name}_count"] <= limits[plural] for name, plural in [("audited_role", "audited_roles"), ("schema", "schemas"), ("relation", "relations"), ("function", "functions"), ("policy", "policies"), ("membership_edge", "membership_edges"), ("default_acl_row", "default_acl_rows")]) and limits["oversized_column_relations"] == 0
        report["complete_within_limits"] = complete
        print(json.dumps(report, sort_keys=True, separators=(",", ":")))
        if not complete or not report["session"]["identity_matches_expected"]:
            return 2
    except (KeyError, TypeError, ValueError, UnicodeDecodeError):
        return fail("invalid-metadata-report")
    return 0


if __name__ == "__main__":
    sys.exit(main())
