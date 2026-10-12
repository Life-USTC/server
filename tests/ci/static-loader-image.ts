import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const databaseUrl = process.env.DATABASE_URL;
assert.ok(
  databaseUrl,
  "DATABASE_URL must point to a disposable PostgreSQL service",
);
const image = "life-ustc-static-loader:check";

const directory = mkdtempSync(join(tmpdir(), "static-loader-image-"));
try {
  const snapshot = join(directory, "fixture.sqlite");
  execFileSync("bun", ["tests/fixtures/static-loader-snapshot.ts", snapshot], {
    stdio: "inherit",
  });
  execFileSync(
    "docker",
    [
      "run",
      "--rm",
      "--network",
      "host",
      "--volume",
      `${directory}:/tmp/static-loader-report:Z`,
      "--volume",
      `${snapshot}:/tmp/static-loader-fixture.sqlite:ro,Z`,
      "--env",
      "DATABASE_URL",
      "--env",
      "STATIC_SNAPSHOT_PATH=/tmp/static-loader-fixture.sqlite",
      "--env",
      "STATIC_LOADER_DRY_RUN=true",
      "--env",
      "STATIC_LOADER_STATS_FILE=/tmp/static-loader-report/report.json",
      image,
    ],
    { stdio: "inherit" },
  );

  const report = JSON.parse(
    readFileSync(join(directory, "report.json"), "utf8"),
  );
  assert.equal(report.mode, "dry-run");
  assert.equal(report.outcome, "rolled-back");
  assert.equal(report.databaseRecordCounts, null);
  assert.equal(report.snapshot?.schemaVersion, "6");
  assert.equal(report.reconciliation?.sectionPresence?.status, "applied");
  assert.ok(
    Number.isInteger(
      report.reconciliation?.sectionPresence?.missingSectionCount,
    ),
  );
  assert.match(report.snapshot?.sha256 ?? "", /^[a-f0-9]{64}$/);
  for (const table of [
    "semesters",
    "courses",
    "sections",
    "teachers",
    "scheduleGroups",
    "schedules",
    "exams",
    "rooms",
    "buildings",
    "campuses",
  ]) {
    assert.equal(
      report.plannedRecordCounts?.[table],
      1,
      `Fixture must exercise ${table}`,
    );
  }

  const remainingRows = execFileSync(
    "psql",
    [
      databaseUrl,
      "-X",
      "-qAt",
      "--set=ON_ERROR_STOP=1",
      "--command",
      `SELECT (SELECT COUNT(*) FROM "Course")
          + (SELECT COUNT(*) FROM "Section")
          + (SELECT COUNT(*) FROM "Teacher")
          + (SELECT COUNT(*) FROM "TeacherAssignment")
          + (SELECT COUNT(*) FROM "RoomType")
          + (SELECT COUNT(*) FROM "Schedule")
          + (SELECT COUNT(*) FROM "Exam")
          + (SELECT COUNT(*) FROM "StaticImportState");`,
    ],
    { encoding: "utf8" },
  ).trim();
  assert.equal(
    remainingRows,
    "0",
    "Dry-run must leave the real database empty",
  );
  console.log("Static loader image and dry-run rollback passed.");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
