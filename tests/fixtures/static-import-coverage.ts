/// <reference path="../../src/static-loader/bun-sqlite.d.ts" />
import { Database } from "bun:sqlite";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runImport } from "../../src/static-loader/import";
import { createTestPrisma } from "../shared/prisma";
import type { StaticImportSnapshot } from "../shared/static-import-process-fixture";

const [mode, firstPath, secondPath, ...extra] = process.argv.slice(2);
if (
  !firstPath ||
  !secondPath ||
  extra.length ||
  !["prepare", "apply"].includes(mode)
)
  throw new Error(
    "Expected prepare <input> <snapshot> or apply <snapshot> <report>",
  );
if (mode === "prepare") {
  const [inputPath, snapshotPath] = [firstPath, secondPath];
  const input = JSON.parse(
    readFileSync(inputPath, "utf8"),
  ) as StaticImportSnapshot;
  // Reuse the complete synthetic schema, then replace its rows with this case's
  // explicit input. The production Snapshot implementation reads the real file.
  execFileSync("bun", [
    fileURLToPath(new URL("./static-loader-snapshot.ts", import.meta.url)),
    snapshotPath,
  ]);
  const snapshot = new Database(snapshotPath);
  try {
    snapshot.run("BEGIN");
    const tables = snapshot
      .query("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
    for (const { name } of tables)
      snapshot.run(`DELETE FROM ${identifier(name)}`);
    const values: StaticImportSnapshot["tables"] = {
      ...input.tables,
      metadata: Object.entries(input.metadata).map(([key, value]) => ({
        key,
        value,
      })),
    };
    for (const [table, rows] of Object.entries(values)) {
      if (rows.length === 0) continue;
      const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
      const insert = snapshot.prepare(
        `INSERT INTO ${identifier(table)} (${columns.map(identifier).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
      );
      for (const row of rows)
        insert.run(
          ...columns.map((column) => {
            const value = row[column];
            return typeof value === "boolean" ? Number(value) : (value ?? null);
          }),
        );
    }
    snapshot.run("COMMIT");
  } finally {
    snapshot.close();
  }
} else {
  const [snapshotPath, reportPath] = [firstPath, secondPath];
  // Static sync runs with the migrator role. The parent owns a separate observer.
  const importerUrl = process.env.FUNCTION_OWNER_DATABASE_URL;
  if (!importerUrl) throw new Error("FUNCTION_OWNER_DATABASE_URL is required");
  const importer = createTestPrisma(importerUrl);
  try {
    const report = await runImport(importer, {
      snapshotPath,
      snapshotSha256: createHash("sha256")
        .update(readFileSync(snapshotPath))
        .digest("hex"),
      dryRun: false,
    });
    writeFileSync(reportPath, JSON.stringify(report));
  } finally {
    await importer.$disconnect();
  }
}
