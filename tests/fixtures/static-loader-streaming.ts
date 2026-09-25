/// <reference path="../../src/static-loader/bun-sqlite.d.ts" />

import { Database } from "bun:sqlite";
import { deepStrictEqual, strictEqual, throws } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Snapshot } from "../../src/static-loader/snapshot";

const directory = mkdtempSync(join(tmpdir(), "static-streaming-"));
const path = join(directory, "fixture.sqlite");
const db = new Database(path, { create: true });
try {
  for (const table of ["parents", "children", "empty"]) {
    db.run(
      `CREATE TABLE ${table} (store_id INTEGER PRIMARY KEY, parent_store_id INTEGER, semester_id TEXT)`,
    );
  }
  // Numeric semester ordering, non-insertion storage order, duplicate children,
  // a child-only semester, a parent-only semester, and an entirely empty table.
  db.run("INSERT INTO parents VALUES (12, NULL, '10'), (11, NULL, '2')");
  db.run(
    "INSERT INTO children VALUES (30, 11, '2'), (10, 11, '2'), (40, 99, '5')",
  );
} finally {
  db.close();
}
try {
  const snapshot = new Snapshot(path);
  try {
    const groups = [
      ...snapshot.iterateSemesterTables(["parents", "children", "empty"]),
    ];
    deepStrictEqual(
      groups.map((tables) =>
        [...tables].map(([name, rows]) => [
          name,
          rows.map((row) => row.store_id),
        ]),
      ),
      [
        [
          ["parents", [11]],
          ["children", [10, 30]],
          ["empty", []],
        ],
        [
          ["parents", []],
          ["children", [40]],
          ["empty", []],
        ],
        [
          ["parents", [12]],
          ["children", []],
          ["empty", []],
        ],
      ],
    );
    strictEqual(
      snapshot.groupByParent(groups[0].get("children") ?? []).get(11)?.[0]
        .store_id,
      10,
    );
    deepStrictEqual(
      [...snapshot.iterateAll("parents")].map((row) => row.store_id),
      [11, 12],
    );
    deepStrictEqual([...snapshot.iterateSemesterTables([])], []);
    throws(
      () => [...snapshot.iterateSemesterTables(['parents"'])],
      /Invalid snapshot table/,
    );
    // Abandoning a consumer must release every active SQLite cursor.
    for (const _group of snapshot.iterateSemesterTables([
      "parents",
      "children",
    ]))
      break;
    deepStrictEqual(
      [...snapshot.iterateAll("children")].map((row) => row.store_id),
      [10, 30, 40],
    );
  } finally {
    snapshot.close();
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
console.log("SQLite semester streaming passed");
