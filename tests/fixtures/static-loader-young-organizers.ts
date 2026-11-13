/// <reference path="../../src/static-loader/bun-sqlite.d.ts" />

import { Database } from "bun:sqlite";
import { deepStrictEqual, strictEqual, throws } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Snapshot } from "../../src/static-loader/snapshot";
import { loadYoungEvents } from "../../src/static-loader/young-plan";

const directory = mkdtempSync(join(tmpdir(), "young-organizer-source-"));
const path = join(directory, "fixture.sqlite");
const active = "young_mobile_item_enrolment_list_result_records";
const ended = "young_mobile_item_end_list_result_records";
const fields = [
  "organizer",
  "organizer_dictText",
  "sponsor",
  "sponsor_dictText",
];

function readPlan() {
  const snapshot = new Snapshot(path);
  try {
    return loadYoungEvents(snapshot);
  } finally {
    snapshot.close();
  }
}

try {
  const db = new Database(path, { create: true });
  try {
    db.run("CREATE TABLE metadata (key TEXT, value TEXT)");
    db.run("INSERT INTO metadata VALUES ('young_events_mode', 'incremental')");
    for (const table of [active, ended]) {
      db.run(
        `CREATE TABLE ${table} (store_id INTEGER PRIMARY KEY, id TEXT, organizer TEXT, organizer_dictText TEXT, sponsor TEXT, sponsor_dictText TEXT)`,
      );
    }
    db.run(
      `INSERT INTO ${active} VALUES (1, 'array', NULL, NULL, NULL, NULL), (2, 'joined', 'b,a,b', 'Club A,Club B,inc.', NULL, NULL), (3, 'absent', NULL, NULL, NULL, NULL)`,
    );
    db.run(
      `INSERT INTO ${ended} VALUES (11, 'array', NULL, 'Ended source label', NULL, NULL)`,
    );
    for (const field of fields) {
      db.run(
        `CREATE TABLE ${active}_${field} (parent_store_id INTEGER, position INTEGER, value TEXT)`,
      );
    }
    // Actual store encoding: scalars go into the parent; lists use ordered
    // child values. Another record's scalar column makes the array row NULL.
    db.run(
      `INSERT INTO ${active}_organizer VALUES (1, 2, 'source-b'), (1, 0, 'source-b'), (1, 1, 'source-a')`,
    );
    db.run(
      `INSERT INTO ${active}_organizer_dictText VALUES (1, 2, 'Club, with comma'), (1, 0, 'Club, with comma'), (1, 3, ''), (1, 1, 'Ｃｌｕｂ Ｂ')`,
    );
    db.run(`INSERT INTO ${active}_sponsor VALUES (1, 0, 'sponsor-id')`);
    db.run(
      `INSERT INTO ${active}_sponsor_dictText VALUES (1, 0, 'Sponsor, with comma')`,
    );
  } finally {
    db.close();
  }

  const plan = readPlan();
  strictEqual(plan?.length, 3);
  const array = plan?.find((row) => row.youngId === "array");
  const raw = JSON.parse(array?.rawJson ?? "{}");
  deepStrictEqual(raw.organizer, ["source-b", "source-a", "source-b"]);
  deepStrictEqual(raw.organizer_dictText, [
    "Club, with comma",
    "Ｃｌｕｂ Ｂ",
    "Club, with comma",
    "",
  ]);
  deepStrictEqual(raw.sponsor, ["sponsor-id"]);
  deepStrictEqual(raw.sponsor_dictText, ["Sponsor, with comma"]);
  strictEqual(raw.store_id, undefined);
  strictEqual(array?.isActive, true);
  // Shadow preservation only: no promotion, source pairing or follow change.
  strictEqual(array?.organizer, undefined);
  strictEqual(array?.sponsor, undefined);
  deepStrictEqual(array?.upstreamOrganizerIds, []);
  const joined = plan?.find((row) => row.youngId === "joined");
  strictEqual(joined?.organizer, "Club A,Club B,inc.");
  strictEqual(
    JSON.parse(joined?.rawJson ?? "{}").organizer_dictText,
    "Club A,Club B,inc.",
  );
  const absent = JSON.parse(
    plan?.find((row) => row.youngId === "absent")?.rawJson ?? "{}",
  );
  strictEqual(absent.organizer, null);
  strictEqual(absent.organizer_dictText, null);

  const conflict = new Database(path, { readwrite: true });
  try {
    conflict.run(
      `INSERT INTO ${active}_organizer_dictText VALUES (2, 0, 'Conflicting child')`,
    );
  } finally {
    conflict.close();
  }
  throws(
    readPlan,
    /Conflicting Young organizer snapshot representations: organizer_dictText/,
  );
  const gap = new Database(path, { readwrite: true });
  try {
    gap.run(
      `DELETE FROM ${active}_organizer_dictText WHERE parent_store_id = 2`,
    );
    gap.run(
      `DELETE FROM ${active}_organizer WHERE parent_store_id = 1 AND position = 1`,
    );
  } finally {
    gap.close();
  }
  throws(readPlan, /Incomplete Young organizer string-array snapshot/);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
console.log("SQLite Young organizer source preservation passed");
