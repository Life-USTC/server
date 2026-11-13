import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Client as PgClient } from "pg";

export const INVENTORY_REPORT_PATH =
  "/tmp/life-young-organizer-inventory-report.json";
const OUTPUT = INVENTORY_REPORT_PATH;
const TEMPORARY = `${OUTPUT}.tmp`;
const SQL_SHA256 =
  "b8e33bc8d0e723e07c8afb2a3e6c9535dcb6ab5cc2880aa487a833402039f3b3";
const REPORTS = [
  [
    "schema_context",
    "report database_name_fingerprint endpoint_fingerprint inventory_transaction_at server_version_num server_encoding transaction_read_only transaction_isolation row_security role_is_superuser role_bypasses_rls actual_relations_expected_five relation_flags key_shapes columns constraints indexes policies",
  ],
  [
    "row_totals",
    "report events organizer_entities organizer_follows organizer_follow_users direct_event_subscriptions notifications",
  ],
  [
    "saved_arrays",
    "report field cardinality event_rows null_slots empty_slots ascii_space_slots duplicate_nonnull_slots events_with_duplicates",
  ],
  [
    "raw_shapes",
    "report raw_type key value_type event_rows empty_strings ascii_space_strings empty_arrays",
  ],
  [
    "raw_array_elements",
    "report key element_type event_rows slots exact_duplicate_slots blank_string_slots",
  ],
  [
    "identity_ambiguity",
    "report direction evidence counterpart_count identities",
  ],
  [
    "provenance_candidates_not_verified",
    "report label_evidence saved_cardinality linked_local_entity event_rows",
  ],
  [
    "legacy_multi_source_candidate_exposure",
    "report candidate_entities linked_events organizer_follow_rows distinct_follow_users separate_direct_event_subscription_rows",
  ],
  [
    "notification_aggregates",
    "report kind is_read expiry organizer_association event_association notifications",
  ],
] as const;

type Stage =
  | "configuration"
  | "connect"
  | "inventory"
  | "validate"
  | "close"
  | "write";
class InventoryFailure extends Error {
  constructor(readonly safeCode: string) {
    super(safeCode);
  }
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function safeCode(error: unknown): string {
  if (error instanceof InventoryFailure) return error.safeCode;
  if (
    isRecord(error) &&
    typeof error.code === "string" &&
    /^[A-Z0-9]{5}$/.test(error.code)
  )
    return error.code;
  return "UNEXPECTED_FAILURE";
}
function removeOwnedOutput(path: string) {
  let file: ReturnType<typeof lstatSync>;
  try {
    file = lstatSync(path);
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return;
    throw error;
  }
  if (!file.isFile() || file.uid !== process.getuid?.())
    throw new InventoryFailure("UNSAFE_OUTPUT_FILE");
  unlinkSync(path);
}
function validateResults(result: unknown) {
  const last: unknown = Array.isArray(result) ? result.at(-1) : undefined;
  if (
    !Array.isArray(result) ||
    !isRecord(last) ||
    last.command !== "ROLLBACK"
  ) {
    throw new InventoryFailure("ROLLBACK_NOT_CONFIRMED");
  }
  const selects = result.filter(
    (entry) => isRecord(entry) && entry.command === "SELECT",
  );
  if (selects.length !== REPORTS.length)
    throw new InventoryFailure("UNEXPECTED_REPORT_COUNT");
  const reports = REPORTS.map(([name, fields], index) => {
    const entry: unknown = selects[index];
    if (
      !isRecord(entry) ||
      !Array.isArray(entry.rows) ||
      !Array.isArray(entry.fields) ||
      entry.rows.length > 1000
    ) {
      throw new InventoryFailure("UNEXPECTED_REPORT_SHAPE");
    }
    const allowed = fields.split(" ").sort();
    const actual = entry.fields
      .map((field) => (isRecord(field) ? field.name : undefined))
      .sort();
    if (JSON.stringify(actual) !== JSON.stringify(allowed))
      throw new InventoryFailure("UNEXPECTED_REPORT_FIELDS");
    const rows = entry.rows;
    if (
      !rows.every(
        (row) =>
          isRecord(row) &&
          row.report === name &&
          JSON.stringify(Object.keys(row).sort()) === JSON.stringify(allowed),
      )
    ) {
      throw new InventoryFailure("UNEXPECTED_REPORT_ROWS");
    }
    return { name, rows };
  });
  const context: unknown = reports[0].rows[0];
  if (
    reports[0].rows.length !== 1 ||
    reports[1].rows.length !== 1 ||
    !isRecord(context) ||
    context.transaction_read_only !== "on" ||
    context.transaction_isolation !== "repeatable read" ||
    context.row_security !== "off" ||
    String(context.actual_relations_expected_five) !== "5"
  ) {
    throw new InventoryFailure("INCOMPLETE_READONLY_CONTEXT");
  }
  return reports;
}

async function main() {
  let stage: Stage = "configuration";
  let client: PgClient | undefined;
  let connected = false;
  let backgroundFailure: unknown;
  let temporaryCreated = false;
  try {
    removeOwnedOutput(OUTPUT);
    removeOwnedOutput(TEMPORARY);
    if (process.argv.length !== 2)
      throw new InventoryFailure("UNEXPECTED_ARGUMENT");
    const connection = process.env.MIGRATOR_DATABASE_URL;
    if (!connection) throw new InventoryFailure("MIGRATOR_PROFILE_REQUIRED");
    if (
      connection !== connection.trim() ||
      Array.from(connection).some(
        (char) => char.charCodeAt(0) <= 0x20 || char.charCodeAt(0) === 0x7f,
      )
    ) {
      throw new InventoryFailure("EXPLICIT_PROFILE_REQUIRED");
    }
    let target: URL;
    try {
      target = new URL(connection);
    } catch {
      throw new InventoryFailure("EXPLICIT_PROFILE_REQUIRED");
    }
    if (
      !["postgres:", "postgresql:"].includes(target.protocol) ||
      !target.hostname ||
      !target.username ||
      !target.password ||
      target.pathname === "/" ||
      !target.pathname ||
      target.hash
    ) {
      throw new InventoryFailure("EXPLICIT_PROFILE_REQUIRED");
    }
    const sql = readFileSync(
      new URL("./young-organizer-inventory.sql", import.meta.url),
    );
    if (createHash("sha256").update(sql).digest("hex") !== SQL_SHA256)
      throw new InventoryFailure("FIXED_SQL_MISMATCH");
    const { Client } = await import("pg");
    client = new Client({
      connectionString: connection,
      connectionTimeoutMillis: 5000,
      query_timeout: 300_000,
      application_name: "life-ustc-young-organizer-inventory",
    });
    client.on("error", (error: unknown) => {
      backgroundFailure ??= error;
    });
    stage = "connect";
    await client.connect();
    connected = true;
    stage = "inventory";
    const result: unknown = await client.query(sql.toString("utf8"));
    stage = "validate";
    const reports = validateResults(result);
    if (backgroundFailure) throw backgroundFailure;
    stage = "close";
    await client.end();
    connected = false;
    client = undefined;
    if (backgroundFailure) throw backgroundFailure;
    const json = `${JSON.stringify(
      {
        formatVersion: 1,
        operation: "inspect-young-organizers",
        targetVerification: "configured-migrator-profile-only",
        sqlSha256: SQL_SHA256,
        rollbackCompleted: true,
        reports,
      },
      null,
      2,
    )}\n`;
    if (Buffer.byteLength(json, "utf8") > 1_000_000)
      throw new InventoryFailure("REPORT_SIZE_LIMIT");
    stage = "write";
    temporaryCreated = true;
    writeFileSync(TEMPORARY, json, { flag: "wx", mode: 0o600 });
    renameSync(TEMPORARY, OUTPUT);
    temporaryCreated = false;
    console.log(
      JSON.stringify({
        operation: "inspect-young-organizers",
        reports: 9,
        rollback: "completed",
      }),
    );
  } catch (error) {
    if (client) {
      if (connected) await client.query("ROLLBACK").catch(() => undefined);
      await client.end().catch(() => undefined);
    }
    if (temporaryCreated) {
      try {
        removeOwnedOutput(TEMPORARY);
      } catch {
        /* No partial report is published. */
      }
    }
    console.error(JSON.stringify({ stage, code: safeCode(error) }));
    process.exitCode = 1;
  }
}
// Importing the fixed output contract for tests/types performs no I/O.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void main();
}
