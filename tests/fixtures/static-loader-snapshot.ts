/// <reference path="../../src/static-loader/bun-sqlite.d.ts" />

import { Database } from "bun:sqlite";
import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";

// Synthetic schema 6 input for the real image entrypoint and database import.
const path = process.argv[2];
if (!path)
  throw new Error(
    "Usage: bun tests/fixtures/static-loader-snapshot.ts <output.sqlite>",
  );
mkdirSync(dirname(path), { recursive: true });
rmSync(path, { force: true });

type Row = Record<string, string | number | null>;
const catalog = "catalog_teach_lesson_list_for_teach";
const lesson = "jw_ws_schedule_table_datum_result_lessonList";
const schedule = "jw_ws_schedule_table_datum_result_scheduleList";
const exam = "catalog_teach_exam_list";
const tables: Record<string, Row[]> = {
  metadata: Object.entries({
    schema_version: "6",
    generated_at: "2026-01-01T00:00:00.000Z",
    catalog_lesson_min_semester_id: "401",
    catalog_exam_min_semester_id: "401",
    jw_schedule_chunk_size: "100",
    jw_schedule_expected_chunk_count_401: "1",
    jw_room_types_status: "complete",
  }).map(([key, value]) => ({ key, value })),
  upstream_fetches: [
    { id: 1, source: catalog, context: "semester_id=401", ok: 1 },
    { id: 2, source: exam, context: "semester_id=401", ok: 1 },
    {
      id: 3,
      source: "jw_ws_schedule_table_datum",
      context: "semester_id=401&chunk_index=0",
      ok: 1,
    },
    {
      id: 4,
      source: "jw_lesson_search_room_types",
      context: "semester_id=401",
      ok: 1,
    },
  ],
  catalog_teach_semester_list: [
    { id: 401, code: "202501", nameZh: "Fixture semester" },
  ],
  [catalog]: [
    {
      id: 101,
      store_id: 11,
      semester_id: 401,
      code: "FIXTURE.01",
      credits: 2,
      period: 32,
    },
  ],
  [`${catalog}_course`]: [
    { parent_store_id: 11, id: 201, code: "FIXTURE", cn: "Fixture course" },
  ],
  [lesson]: [
    {
      id: 101,
      store_id: 21,
      semester_id: 401,
      roomTypeId: 27,
      actualPeriods: 32,
      stdCount: 20,
      limitCount: 30,
    },
  ],
  [`${lesson}_teacherAssignmentList`]: [
    {
      parent_store_id: 21,
      store_id: 31,
      semester_id: 401,
      teacherId: 301,
      personId: 301,
      name: "Fixture teacher",
      code: "FIXTURE-T",
      period: 1.5,
    },
  ],
  jw_ws_schedule_table_datum_result_scheduleGroupList: [
    {
      id: 701,
      lessonId: 101,
      no: 1,
      limitCount: 30,
      stdCount: 20,
      actualPeriods: 32,
      isDefault: 1,
    },
  ],
  [schedule]: [
    {
      store_id: 41,
      semester_id: 401,
      lessonId: 101,
      scheduleGroupId: 701,
      teacherId: 301,
      personId: 301,
      personName: "Fixture teacher",
      date: "2025-09-01",
      weekday: 1,
      startTime: 750,
      endTime: 925,
      weekIndex: 1,
      periods: 2,
    },
  ],
  [`${schedule}_room`]: [
    {
      parent_store_id: 41,
      store_id: 51,
      semester_id: 401,
      id: 401,
      code: "R101",
      nameZh: "Fixture room",
      seats: 30,
      seatsForLesson: 30,
      virtual: 0,
    },
  ],
  [`${schedule}_room_building`]: [
    {
      parent_store_id: 51,
      store_id: 61,
      semester_id: 401,
      id: 501,
      nameZh: "Fixture building",
      code: "B1",
    },
  ],
  [`${schedule}_room_building_campus`]: [
    {
      store_id: 62,
      parent_store_id: 61,
      semester_id: 401,
      id: 601,
      nameZh: "Fixture campus",
      code: "C1",
    },
  ],
  [`${schedule}_room_roomType`]: [
    {
      store_id: 63,
      parent_store_id: 51,
      semester_id: 401,
      id: 24,
      code: "2",
      nameZh: "Fixture scheduled room type",
    },
  ],
  // The requested type has no scheduled room, exercising the supplemental dictionary.
  jw_room_types: [
    {
      id: 27,
      semester_id: 401,
      fetch_id: 4,
      code: "5",
      nameZh: "Fixture requested room type",
      nameEn: null,
    },
  ],
  [exam]: [
    {
      id: 801,
      store_id: 71,
      examDate: "2025-12-01",
      startTime: 900,
      endTime: 1100,
      examTakeCount: 20,
    },
  ],
  [`${exam}_lesson`]: [{ parent_store_id: 71, id: 101 }],
  [`${exam}_examRooms`]: [
    { parent_store_id: 71, room: "Fixture exam room", count: 20 },
  ],
};

const emptyTables = [
  "catalog_teach_department_college_tree",
  "catalog_teach_department_college_tree_children",
  ...[
    "classType",
    "courseCategory",
    "courseClassify",
    "courseGradation",
    "courseType",
    "education",
    "examMode",
    "teachLang",
    "campus",
    "adminClasses",
    "dateTimePlacePersonText",
    "openDepartment",
    "teacherAssignmentList",
  ].map((suffix) => `${catalog}_${suffix}`),
  ...[
    "adminclasses",
    "requiredPeriodInfo",
    "scheduleJsonParams",
    "suggestScheduleWeeks",
    "teacherAssignmentList_teacherLessonType",
    "teacherAssignmentList_title",
    "teacherAssignmentList_weekIndices",
    "teacherAssignmentList_contactInfo",
  ].map((suffix) => `${lesson}_${suffix}`),
  `${exam}_examBatch`,
  `${exam}_monitors`,
];
const db = new Database(path, { create: true });
try {
  db.run("BEGIN");
  for (const table of emptyTables) {
    db.run(
      `CREATE TABLE "${table}" (store_id INTEGER, parent_store_id INTEGER, semester_id INTEGER)`,
    );
  }
  for (const [table, rows] of Object.entries(tables)) {
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    db.run(
      `CREATE TABLE "${table}" (${columns.map((column) => `"${column}"`).join(", ")})`,
    );
    const insert = db.prepare(
      `INSERT INTO "${table}" VALUES (${columns.map(() => "?").join(", ")})`,
    );
    for (const row of rows)
      insert.run(...columns.map((column) => row[column] ?? null));
  }
  db.run("COMMIT");
} finally {
  db.close();
}
