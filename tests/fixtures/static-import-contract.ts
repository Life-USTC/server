/// <reference path="../../src/static-loader/bun-sqlite.d.ts" />
import { Database } from "bun:sqlite";
import { deepStrictEqual, rejects, strictEqual } from "node:assert";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runImport } from "../../src/static-loader/import";
import { STATIC_IMPORT_TRANSFORM_REVISION } from "../../src/static-loader/import-state";
import { createFixturePrisma, createTestPrisma } from "../shared/prisma";

const scenario = process.argv[2];
const path = process.argv[3];
if (!path) throw new Error("Expected a test-owned snapshot path");
const fixture = createFixturePrisma();
const importerUrl = process.env.IMPORTER_DATABASE_URL;
if (!importerUrl) throw new Error("IMPORTER_DATABASE_URL is required");
const importer = createTestPrisma(importerUrl);
const base = 1500000000;
const semesterJwId = base + 401;
const sectionJwId = base + 101;
const courseJwId = base + 201;
const catalog = "catalog_teach_lesson_list_for_teach";
const originalTime = new Date("2026-09-01T00:00:00Z").getTime();
let generation = 0;
let observedAt = new Date(originalTime);
let snapshotSha256 = "";
function change(sql: string, ...values: (string | number)[]) {
  const db = new Database(path);
  try {
    db.run(sql, values);
  } finally {
    db.close();
  }
}
async function apply() {
  observedAt = new Date(originalTime + ++generation * 1000);
  change(
    "UPDATE metadata SET value = ? WHERE key = 'generated_at'",
    observedAt.toISOString(),
  );
  snapshotSha256 = createHash("sha256")
    .update(readFileSync(path))
    .digest("hex");
  return runImport(importer, {
    snapshotPath: path,
    snapshotSha256,
    dryRun: false,
  });
}
const section = () =>
  fixture.section.findUniqueOrThrow({
    where: { jwId: sectionJwId },
    include: { course: true },
  });
async function storedRevision() {
  return fixture.staticImportState.findUnique({ where: { id: "global" } });
}
async function presenceFixture() {
  await apply();
  const current = await section();
  await fixture.section.update({
    where: { id: current.id },
    data: { retiredAt: new Date(originalTime - 1000) },
  });
  const missing = await fixture.section.create({
    data: {
      jwId: base + 102,
      code: `missing-${base}`,
      semesterId: current.semesterId,
      courseId: current.courseId,
    },
  });
  return { current, missing };
}
try {
  const [role] = await importer.$queryRaw<
    Array<{ currentUser: string }>
  >`SELECT current_user AS "currentUser"`;
  strictEqual(role.currentUser, "life_ustc_importer");
  execFileSync("bun", [
    fileURLToPath(new URL("./static-loader-snapshot.ts", import.meta.url)),
    path,
  ]);
  const db = new Database(path);
  try {
    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    for (const { name } of tables) {
      if (name === "upstream_fetches" || name === "metadata") continue;
      const columns = (
        db.query(`PRAGMA table_info("${name}")`).all() as { name: string }[]
      ).map((column) => column.name);
      for (const column of [
        "id",
        "semester_id",
        "lessonId",
        "teacherId",
        "personId",
        "roomTypeId",
        "scheduleGroupId",
      ]) {
        if (columns.includes(column))
          db.run(`UPDATE "${name}" SET "${column}" = "${column}" + ?`, [base]);
      }
      if (columns.includes("code"))
        db.run(`UPDATE "${name}" SET code = code || ?`, [`-${base}`]);
    }
    db.run(
      "UPDATE metadata SET value = ? WHERE key IN ('catalog_lesson_min_semester_id', 'catalog_exam_min_semester_id')",
      [String(semesterJwId)],
    );
    db.run(
      "UPDATE metadata SET key = ? WHERE key = 'jw_schedule_expected_chunk_count_401'",
      [`jw_schedule_expected_chunk_count_${semesterJwId}`],
    );
    db.run(
      "UPDATE upstream_fetches SET context = replace(context, 'semester_id=401', ?)",
      [`semester_id=${semesterJwId}`],
    );
  } finally {
    db.close();
  }

  switch (scenario) {
    case "course.official-profile-import": {
      const first = await apply();
      const legacy = await section();
      const retainedCourseId = courseJwId + 1;
      const addedCourseId = courseJwId + 2;
      const retained = await fixture.course.create({
        data: {
          jwId: retainedCourseId,
          code: "RETAINED",
          nameCn: "Existing catalog name",
        },
      });
      const category = await fixture.courseCategory.create({
        data: {
          nameCn: "已有课程类别",
          nameEn: "Existing category translation",
        },
      });
      const courseTable = "catalog_teach_course_infos";
      const sectionTable = "catalog_teach_lesson_infos";
      change(
        `CREATE TABLE ${courseTable} (id INTEGER, code TEXT, payload_json TEXT)`,
      );
      change(
        `CREATE TABLE ${sectionTable} (id INTEGER, code TEXT, courseId INTEGER, semester_id INTEGER, payload_json TEXT)`,
      );

      const courses = [
        {
          id: courseJwId,
          code: "FIXTURE-NEW",
          name: { cn: "Updated", en: null },
        },
        {
          id: retainedCourseId,
          code: "RETAINED",
          name: { cn: "Incoming name", en: null },
        },
        {
          id: addedCourseId,
          code: "ADDED",
          name: { cn: "New public course", en: "Added course" },
        },
      ];
      const courseProfile = (course: (typeof courses)[number]) => ({
        ...course,
        credit: 1.5,
        courseCategory: category.nameCn,
        courseClassify: "新增课程分类",
        desc: { cn: "独立课程简介", en: null },
      });
      for (const course of courses)
        change(
          `INSERT INTO ${courseTable} VALUES (?, ?, ?)`,
          course.id,
          course.code,
          JSON.stringify(courseProfile(course)),
        );
      const sectionProfile = {
        id: sectionJwId,
        code: "FIXTURE.02",
        courseId: courseJwId,
        credit: 2,
        syllabus: [{ topic: "Teaching class topic" }],
      };
      const missingSection = {
        ...sectionProfile,
        id: sectionJwId + 1,
        code: "FIXTURE.03",
      };
      for (const profile of [sectionProfile, missingSection])
        change(
          `INSERT INTO ${sectionTable} VALUES (?, ?, ?, ?, ?)`,
          profile.id,
          profile.code,
          courseJwId,
          semesterJwId,
          JSON.stringify(profile),
        );

      const applied = await apply();
      strictEqual(first.plannedRecordCounts?.courses, 1);
      strictEqual(applied.plannedRecordCounts?.courses, 3);
      const current = await section();
      strictEqual(current.id, legacy.id);
      strictEqual(current.code, legacy.code);
      strictEqual(current.course.id, legacy.course.id);
      strictEqual(current.course.code, legacy.course.code);
      deepStrictEqual(
        current.course.officialProfile,
        courseProfile(courses[0]),
      );
      deepStrictEqual(current.officialProfile, sectionProfile);
      const retainedAfter = await fixture.course.findUniqueOrThrow({
        where: { jwId: retainedCourseId },
      });
      strictEqual(retainedAfter.id, retained.id);
      strictEqual(retainedAfter.nameCn, retained.nameCn);
      strictEqual(retainedAfter.officialCatalogOnly, false);
      deepStrictEqual(retainedAfter.officialProfile, courseProfile(courses[1]));
      const added = await fixture.course.findUniqueOrThrow({
        where: { jwId: addedCourseId },
        include: { category: true, classify: true },
      });
      strictEqual(added.code, "ADDED");
      strictEqual(added.nameCn, "New public course");
      strictEqual(added.nameEn, "Added course");
      strictEqual(added.officialCatalogOnly, true);
      deepStrictEqual(added.category, category);
      strictEqual(added.classify?.nameCn, "新增课程分类");
      deepStrictEqual(added.officialProfile, courseProfile(courses[2]));
      strictEqual(
        await fixture.section.count({
          where: { jwId: sectionJwId + 1 },
        }),
        0,
      );

      const renamed = {
        ...courseProfile(courses[2]),
        name: { cn: "新目录名称", en: "Updated public course" },
      };
      change(
        `UPDATE ${courseTable} SET payload_json = ? WHERE id = ?`,
        JSON.stringify(renamed),
        addedCourseId,
      );
      await apply();
      const fromOfficialCatalog = await fixture.course.findUniqueOrThrow({
        where: { jwId: addedCourseId },
      });
      strictEqual(fromOfficialCatalog.id, added.id);
      strictEqual(fromOfficialCatalog.nameCn, renamed.name.cn);
      strictEqual(fromOfficialCatalog.nameEn, renamed.name.en);
      strictEqual(fromOfficialCatalog.officialCatalogOnly, true);

      change(
        `UPDATE ${catalog}_course SET id = ?, code = ?, cn = ?`,
        addedCourseId,
        "ADDED-ARCHIVE",
        "Archived course name",
      );
      await apply();
      const fromSemester = (await section()).course;
      strictEqual(fromSemester.id, added.id);
      strictEqual(fromSemester.nameCn, "Archived course name");
      strictEqual(fromSemester.officialCatalogOnly, false);

      change(
        `UPDATE ${catalog}_course SET id = ?, code = ?, cn = ?`,
        courseJwId,
        legacy.course.code,
        legacy.course.nameCn,
      );
      await apply();
      const noLongerInSemester = await fixture.course.findUniqueOrThrow({
        where: { jwId: addedCourseId },
      });
      strictEqual(noLongerInSemester.nameCn, fromSemester.nameCn);
      strictEqual(noLongerInSemester.code, fromSemester.code);
      strictEqual(noLongerInSemester.officialCatalogOnly, false);
      deepStrictEqual(noLongerInSemester.officialProfile, renamed);

      change(`DROP TABLE ${sectionTable}`);
      change(`DROP TABLE ${courseTable}`);
      await apply();
      deepStrictEqual((await section()).officialProfile, sectionProfile);
      deepStrictEqual(
        (await section()).course.officialProfile,
        current.course.officialProfile,
      );
      break;
    }
    case "course.static-section-course-link": {
      await apply();
      strictEqual((await section()).course.jwId, courseJwId);
      change(`UPDATE ${catalog}_course SET id = ?`, courseJwId + 1);
      await apply();
      strictEqual((await section()).course.jwId, courseJwId + 1);
      const before = await storedRevision();
      change(`DELETE FROM ${catalog}_course`);
      await rejects(apply, /Course jwId is missing for lesson parent/);
      deepStrictEqual(await storedRevision(), before);
      strictEqual((await section()).course.jwId, courseJwId + 1);
      break;
    }
    case "course.static-classification-unsupported": {
      change(`ALTER TABLE ${catalog}_courseCategory ADD COLUMN cn TEXT`);
      change(
        `INSERT INTO ${catalog}_courseCategory (parent_store_id, cn) VALUES (11, ?)`,
        `自然科学-${base}`,
      );
      await apply();
      strictEqual((await section()).course.classifyId, null);
      const classify = await fixture.courseClassify.create({
        data: { nameCn: `obsolete-${base}` },
      });
      await fixture.course.update({
        where: { jwId: courseJwId },
        data: { classifyId: classify.id },
      });
      await apply();
      strictEqual((await section()).course.classifyId, null);
      break;
    }
    case "section.source-lifecycle": {
      change("UPDATE upstream_fetches SET ok = 0 WHERE source = ?", catalog);
      const before = await storedRevision();
      await rejects(apply, /fetch|coverage|complete/i);
      strictEqual(
        await fixture.semester.count({ where: { jwId: semesterJwId } }),
        0,
      );
      strictEqual(
        await fixture.course.count({ where: { jwId: courseJwId } }),
        0,
      );
      strictEqual(
        await fixture.section.count({ where: { jwId: sectionJwId } }),
        0,
      );
      deepStrictEqual(await storedRevision(), before);
      break;
    }
    case "section.source-import-atomicity": {
      await apply();
      const before = await storedRevision();
      const current = await section();
      // A real PostgreSQL trigger fails the final revision write, after all
      // catalog writes and lifecycle auditing have run in the same transaction.
      await fixture.$executeRawUnsafe(
        `CREATE FUNCTION public.reject_static_contract_${base}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."snapshotSha256" <> OLD."snapshotSha256" THEN RAISE EXCEPTION 'static contract final write rejected'; END IF; RETURN NEW; END $$`,
      );
      await fixture.$executeRawUnsafe(
        `CREATE TRIGGER reject_static_contract_${base} BEFORE UPDATE ON public."StaticImportState" FOR EACH ROW EXECUTE FUNCTION public.reject_static_contract_${base}()`,
      );
      try {
        change(`UPDATE ${catalog}_course SET cn = 'Changed but rolled back'`);
        change(`UPDATE ${catalog} SET credits = 99`);
        await rejects(apply, /static contract final write rejected/);
        deepStrictEqual(await storedRevision(), before);
        deepStrictEqual(await section(), current);
      } finally {
        await fixture.$executeRawUnsafe(
          `DROP TRIGGER reject_static_contract_${base} ON public."StaticImportState"`,
        );
        await fixture.$executeRawUnsafe(
          `DROP FUNCTION public.reject_static_contract_${base}()`,
        );
      }
      await apply();
      strictEqual((await section()).course.nameCn, "Changed but rolled back");
      strictEqual((await section()).credits, 99);
      const committed = await storedRevision();
      strictEqual(committed?.snapshotSha256, snapshotSha256);
      strictEqual(
        committed?.snapshotGeneratedAt.toISOString(),
        observedAt.toISOString(),
      );
      strictEqual(
        committed?.transformRevision,
        STATIC_IMPORT_TRANSFORM_REVISION,
      );
      break;
    }
    case "section.source-section-presence": {
      const { current, missing } = await presenceFixture();
      await apply();
      strictEqual((await section()).retiredAt, null);
      strictEqual(
        (
          await fixture.section.findUniqueOrThrow({ where: { id: missing.id } })
        ).retiredAt?.toISOString(),
        observedAt.toISOString(),
      );
      // The same upstream identity returns without replacing its database row.
      change(`UPDATE ${catalog} SET id = ?`, missing.jwId);
      await apply();
      strictEqual(
        (await fixture.section.findUniqueOrThrow({ where: { id: missing.id } }))
          .retiredAt,
        null,
      );
      strictEqual(
        (
          await fixture.section.findUniqueOrThrow({ where: { id: current.id } })
        ).retiredAt?.toISOString(),
        observedAt.toISOString(),
      );
      break;
    }
    case "section.retirement-audit": {
      const { current, missing } = await presenceFixture();
      await apply();
      const where = {
        targetType: "section",
        targetId: { in: [String(current.id), String(missing.id)] },
      };
      const rows = await fixture.auditLog.findMany({
        where,
        orderBy: { action: "asc" },
      });
      deepStrictEqual(
        rows
          .sort((a, b) => a.action.localeCompare(b.action))
          .map((row) => [row.action, row.targetId]),
        [
          ["section_reactivate", String(current.id)],
          ["section_retire", String(missing.id)],
        ],
      );
      for (const row of rows) {
        const metadata = row.metadata as Record<string, unknown>;
        strictEqual(metadata.snapshotSha256, snapshotSha256);
        strictEqual(metadata.observedAt, observedAt.toISOString());
      }
      await apply();
      strictEqual(await fixture.auditLog.count({ where }), 2);
      break;
    }
    case "section.retirement-report": {
      await presenceFixture();
      const report = await apply();
      deepStrictEqual(report.reconciliation.sectionPresence, {
        status: "applied",
        scopeSemesterCount: 1,
        seenSectionCount: 1,
        missingSectionCount: 1,
        deactivatedCount: 1,
        reactivatedCount: 1,
        before: { active: 1, retired: 1, total: 2 },
        after: { active: 1, retired: 1, total: 2 },
      });
      strictEqual(report.outcome, "committed");
      strictEqual(report.snapshot.sha256, snapshotSha256);
      const replay = await apply();
      deepStrictEqual(replay.reconciliation.sectionPresence, {
        status: "applied",
        scopeSemesterCount: 1,
        seenSectionCount: 1,
        missingSectionCount: 0,
        deactivatedCount: 0,
        reactivatedCount: 0,
        before: { active: 1, retired: 1, total: 2 },
        after: { active: 1, retired: 1, total: 2 },
      });
      break;
    }
    default:
      throw new Error(`Unknown static contract: ${scenario}`);
  }
  console.log(`CONTRACT_PASSED:${scenario}`);
} finally {
  // The parent test owns the database and snapshot, including early failures.
  await Promise.all([importer.$disconnect(), fixture.$disconnect()]);
}
