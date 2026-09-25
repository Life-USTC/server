/// <reference path="../../src/static-loader/bun-sqlite.d.ts" />

import { afterAll, describe, expect, it, vi } from "vitest";
import {
  syncYoungEvents,
  syncYoungSnapshot,
} from "@/static-loader/import-young";
import type { ScheduleBuild } from "@/static-loader/mappers";
import { createFixturePrisma, disconnectTestPrisma } from "../shared/prisma";

vi.mock("bun:sqlite", () => ({ Database: class {} }));
const { upsertAdminClasses } = await import("@/static-loader/import");
const { writeAdminClassSections, writeSectionTeachers } = await import(
  "@/static-loader/relation-writes"
);
const { writeSchedules } = await import("@/static-loader/schedule-writes");
const { bulkUpsert, syncJoinPairs } = await import(
  "@/static-loader/database-writes"
);

const prisma = createFixturePrisma();

afterAll(async () => {
  await disconnectTestPrisma(prisma);
});

async function tupleId(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  table: string,
  where: string,
): Promise<string> {
  const [row] = await tx.$queryRawUnsafe<Array<{ tupleId: string }>>(
    `SELECT ctid::text AS "tupleId" FROM "${table}" WHERE ${where}`,
  );
  if (row == null) throw new Error(`Missing ${table} test row`);
  return row.tupleId;
}

describe("static import write churn", () => {
  it("syncs production-sized join sets within PostgreSQL stack limits", async () => {
    const rollback = new Error("ROLLBACK_JOIN_SYNC_STACK_TEST");

    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `CREATE TEMP TABLE "StaticJoinPairProbe" (
            "A" int NOT NULL,
            "B" int NOT NULL,
            PRIMARY KEY ("A", "B")
          ) ON COMMIT DROP`,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "StaticJoinPairProbe" ("A", "B") VALUES (1, 11), (1, 999999)`,
        );
        await tx.$executeRawUnsafe("SET LOCAL max_stack_depth = '100kB'");

        const pairs = Array.from({ length: 6_000 }, (_, index) => ({
          a: Math.floor(index / 6) + 1,
          b: index + 1,
        }));
        await syncJoinPairs(
          tx,
          "StaticJoinPairProbe",
          "A",
          Array.from({ length: 1_000 }, (_, index) => index + 1),
          pairs,
        );

        await expect(
          tx.$queryRawUnsafe<Array<{ count: bigint }>>(
            `SELECT COUNT(*) AS count FROM "StaticJoinPairProbe"`,
          ),
        ).resolves.toEqual([{ count: 6_000n }]);
        await expect(
          tx.$queryRawUnsafe<Array<{ exists: boolean }>>(
            `SELECT EXISTS (
              SELECT 1 FROM "StaticJoinPairProbe"
              WHERE "A" = 1 AND "B" = 999999
            ) AS exists`,
          ),
        ).resolves.toEqual([{ exists: false }]);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("upserts AdminClass metadata directly by jwId", async () => {
    const rollback = new Error("ROLLBACK_ADMIN_CLASS_IDENTITY_TEST");
    const marker = 1_600_000_000 + (Date.now() % 100_000_000) * 2;

    try {
      await prisma.$transaction(async (tx) => {
        const first = await tx.adminClass.create({
          data: { jwId: marker, nameCn: `${marker}-first` },
        });
        const second = await tx.adminClass.create({
          data: { jwId: marker + 1, nameCn: `${marker}-second` },
        });

        const idByJwId = await upsertAdminClasses(tx, [
          { jwId: marker, nameCn: `${marker}-first-updated` },
          { jwId: marker + 1, nameCn: `${marker}-second-updated` },
        ]);

        await expect(
          tx.adminClass.findMany({
            where: { id: { in: [first.id, second.id] } },
            orderBy: { jwId: "asc" },
            select: { id: true, jwId: true, nameCn: true },
          }),
        ).resolves.toEqual([
          { id: first.id, jwId: marker, nameCn: `${marker}-first-updated` },
          {
            id: second.id,
            jwId: marker + 1,
            nameCn: `${marker}-second-updated`,
          },
        ]);
        expect(idByJwId).toEqual(
          new Map([
            [marker, first.id],
            [marker + 1, second.id],
          ]),
        );

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("skips unchanged bulk upserts while still returning their ids", async () => {
    const rollback = new Error("ROLLBACK_BULK_UPSERT_CHURN_TEST");
    const marker = 1_700_000_000 + (Date.now() % 100_000_000);

    try {
      await prisma.$transaction(async (tx) => {
        const record = {
          key: marker,
          values: [`${marker}-code`, `${marker}-name`],
        };
        const first = await bulkUpsert(
          tx,
          "Course",
          "jwId",
          "int",
          ["code", "nameCn"],
          ["text", "text"],
          [record],
        );
        const firstTuple = await tupleId(tx, "Course", `"jwId" = ${marker}`);

        const second = await bulkUpsert(
          tx,
          "Course",
          "jwId",
          "int",
          ["code", "nameCn"],
          ["text", "text"],
          [record],
        );
        const secondTuple = await tupleId(tx, "Course", `"jwId" = ${marker}`);

        expect(second.get(marker)).toBe(first.get(marker));
        expect(secondTuple).toBe(firstTuple);

        await bulkUpsert(
          tx,
          "Course",
          "jwId",
          "int",
          ["code", "nameCn"],
          ["text", "text"],
          [{ ...record, values: [`${marker}-code`, `${marker}-changed`] }],
        );
        expect(await tupleId(tx, "Course", `"jwId" = ${marker}`)).not.toBe(
          firstTuple,
        );

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("preserves unchanged schedules and joins, then applies real changes", async () => {
    const rollback = new Error("ROLLBACK_SCHEDULE_CHURN_TEST");
    const marker = 1_800_000_000 + (Date.now() % 100_000_000);

    try {
      await prisma.$transaction(async (tx) => {
        const course = await tx.course.create({
          data: {
            jwId: marker,
            code: `${marker}`,
            nameCn: `${marker}`,
          },
        });
        const section = await tx.section.create({
          data: {
            jwId: marker,
            code: `${marker}`,
            courseId: course.id,
          },
        });
        const group = await tx.scheduleGroup.create({
          data: {
            jwId: marker,
            no: 1,
            limitCount: 1,
            stdCount: 1,
            actualPeriods: 1,
            isDefault: true,
            sectionId: section.id,
          },
        });
        const department = await tx.department.create({
          data: { code: `${marker}`, nameCn: `${marker}` },
        });
        const firstTeacher = await tx.teacher.create({
          data: {
            jwId: marker,
            personId: marker,
            code: `${marker}`,
            nameCn: `${marker}`,
            departmentId: department.id,
          },
        });
        const secondTeacher = await tx.teacher.create({
          data: {
            jwId: marker + 1,
            personId: marker + 1,
            code: `${marker + 1}`,
            nameCn: `${marker + 1}`,
            departmentId: department.id,
          },
        });
        const sectionMap = new Map([[section.jwId, section.id]]);
        const groupMap = new Map([[group.jwId, group.id]]);
        const teacherMap = new Map([
          [marker, firstTeacher.id],
          [marker + 1, secondTeacher.id],
        ]);
        const schedule: ScheduleBuild = {
          periods: 2,
          weekday: 1,
          startTime: 750,
          endTime: 925,
          customPlace: `${marker}`,
          lessonType: "lecture",
          weekIndex: 1,
          exerciseClass: false,
          startUnit: 0,
          endUnit: 0,
          lessonJwId: section.jwId,
          scheduleGroupJwId: group.jwId,
          teacherParticipations: [
            { teacherJwId: marker, periods: 2, exerciseClass: false },
          ],
        };

        await writeSchedules(
          tx,
          [schedule],
          sectionMap,
          groupMap,
          new Map(),
          teacherMap,
          [section.id],
        );
        const firstRow = await tx.schedule.findFirstOrThrow({
          where: { sectionId: section.id },
          include: { teacherParticipations: true },
        });
        const firstTuple = await tupleId(
          tx,
          "Schedule",
          `"id" = ${firstRow.id}`,
        );
        const firstJoinTuple = await tupleId(
          tx,
          "_ScheduleTeachers",
          `"A" = ${firstRow.id}`,
        );

        await writeSchedules(
          tx,
          [schedule],
          sectionMap,
          groupMap,
          new Map(),
          teacherMap,
          [section.id],
        );
        const unchanged = await tx.schedule.findFirstOrThrow({
          where: { sectionId: section.id },
          include: { teacherParticipations: true },
        });

        expect(unchanged.id).toBe(firstRow.id);
        expect(await tupleId(tx, "Schedule", `"id" = ${firstRow.id}`)).toBe(
          firstTuple,
        );
        expect(
          await tupleId(tx, "_ScheduleTeachers", `"A" = ${firstRow.id}`),
        ).toBe(firstJoinTuple);

        const participationOnlyChange: ScheduleBuild = {
          ...schedule,
          teacherParticipations: [
            { teacherJwId: marker, periods: 1.5, exerciseClass: false },
            { teacherJwId: marker + 1, periods: 2, exerciseClass: false },
          ],
        };
        await writeSchedules(
          tx,
          [participationOnlyChange],
          sectionMap,
          groupMap,
          new Map(),
          teacherMap,
          [section.id],
        );
        expect(await tupleId(tx, "Schedule", `"id" = ${firstRow.id}`)).toBe(
          firstTuple,
        );
        expect(
          await tx.scheduleTeacher.findMany({
            where: { scheduleId: firstRow.id },
            orderBy: { teacherId: "asc" },
            select: { teacherId: true, periods: true, exerciseClass: true },
          }),
        ).toEqual([
          { teacherId: firstTeacher.id, periods: 1.5, exerciseClass: false },
          { teacherId: secondTeacher.id, periods: 2, exerciseClass: false },
        ]);
        const mixed: ScheduleBuild = {
          ...participationOnlyChange,
          exerciseClass: null,
          teacherParticipations: [
            { teacherJwId: marker, periods: 1.5, exerciseClass: true },
            { teacherJwId: marker + 1, periods: 2, exerciseClass: false },
          ],
        };
        await writeSchedules(
          tx,
          [mixed],
          sectionMap,
          groupMap,
          new Map(),
          teacherMap,
          [section.id],
        );
        const mixedTuple = await tupleId(
          tx,
          "Schedule",
          `"id" = ${firstRow.id}`,
        );
        const mixedJoinTuple = await tupleId(
          tx,
          "_ScheduleTeachers",
          `"A" = ${firstRow.id} AND "B" = ${firstTeacher.id}`,
        );
        await writeSchedules(
          tx,
          [mixed],
          sectionMap,
          groupMap,
          new Map(),
          teacherMap,
          [section.id],
        );
        expect(await tupleId(tx, "Schedule", `"id" = ${firstRow.id}`)).toBe(
          mixedTuple,
        );
        expect(
          await tupleId(
            tx,
            "_ScheduleTeachers",
            `"A" = ${firstRow.id} AND "B" = ${firstTeacher.id}`,
          ),
        ).toBe(mixedJoinTuple);
        expect(
          await tx.schedule.findUniqueOrThrow({ where: { id: firstRow.id } }),
        ).toMatchObject({ exerciseClass: null });

        // Restore the original source: stale participants are removed and metadata resets.
        await writeSchedules(
          tx,
          [schedule],
          sectionMap,
          groupMap,
          new Map(),
          teacherMap,
          [section.id],
        );
        const restoredJoinTuple = await tupleId(
          tx,
          "_ScheduleTeachers",
          `"A" = ${firstRow.id}`,
        );

        const scheduleWithDerivedUnits = {
          ...schedule,
          startUnit: 1,
          endUnit: 2,
        };
        await writeSchedules(
          tx,
          [scheduleWithDerivedUnits],
          sectionMap,
          groupMap,
          new Map(),
          teacherMap,
          [section.id],
        );
        const unitsChanged = await tx.schedule.findFirstOrThrow({
          where: { sectionId: section.id },
          include: { teacherParticipations: true },
        });

        expect(unitsChanged).toMatchObject({
          id: firstRow.id,
          startUnit: 1,
          endUnit: 2,
          teacherParticipations: [
            { teacherId: firstTeacher.id, periods: 2, exerciseClass: false },
          ],
        });
        expect(await tupleId(tx, "Schedule", `"id" = ${firstRow.id}`)).not.toBe(
          firstTuple,
        );
        expect(
          await tupleId(tx, "_ScheduleTeachers", `"A" = ${firstRow.id}`),
        ).toBe(restoredJoinTuple);

        await writeSchedules(
          tx,
          [
            {
              ...scheduleWithDerivedUnits,
              periods: 3,
              lessonType: "seminar",
              exerciseClass: true,
              teacherParticipations: [
                { teacherJwId: marker + 1, periods: 3, exerciseClass: true },
              ],
            },
          ],
          sectionMap,
          groupMap,
          new Map(),
          teacherMap,
          [section.id],
        );
        const changed = await tx.schedule.findFirstOrThrow({
          where: { sectionId: section.id },
          include: { teacherParticipations: true },
        });

        expect(changed).toMatchObject({
          id: firstRow.id,
          periods: 3,
          lessonType: "seminar",
          teacherParticipations: [
            { teacherId: secondTeacher.id, periods: 3, exerciseClass: true },
          ],
        });
        expect(await tupleId(tx, "Schedule", `"id" = ${firstRow.id}`)).not.toBe(
          firstTuple,
        );

        await writeSchedules(
          tx,
          [
            {
              ...scheduleWithDerivedUnits,
              customPlace: `${marker}-replacement`,
            },
          ],
          sectionMap,
          groupMap,
          new Map(),
          teacherMap,
          [section.id],
        );
        const replacement = await tx.schedule.findMany({
          where: { sectionId: section.id },
        });
        expect(replacement).toHaveLength(1);
        expect(replacement[0]).toMatchObject({
          customPlace: `${marker}-replacement`,
        });
        expect(replacement[0]?.id).not.toBe(firstRow.id);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("reconciles complete sections across the batch boundary without touching uncovered schedules", async () => {
    const rollback = new Error("ROLLBACK_SCHEDULE_BATCH_SCOPE_TEST");
    const marker = 1_600_000_000 + (Date.now() % 100_000_000);
    try {
      await prisma.$transaction(async (tx) => {
        const course = await tx.course.create({
          data: { jwId: marker, code: `${marker}`, nameCn: `${marker}` },
        });
        const sections = (
          await tx.section.createManyAndReturn({
            data: Array.from({ length: 502 }, (_, index) => ({
              jwId: marker + index,
              code: `${marker}-${index}`,
              courseId: course.id,
            })),
          })
        ).sort((a, b) => a.jwId - b.jwId);
        const [staleSection, keptSection, uncoveredSection] = [
          sections[0],
          sections[500],
          sections[501],
        ];
        const groups = await tx.scheduleGroup.createManyAndReturn({
          data: [staleSection, keptSection, uncoveredSection].map(
            (section) => ({
              jwId: section.jwId,
              sectionId: section.id,
              no: 1,
              limitCount: 1,
              stdCount: 1,
              actualPeriods: 1,
              isDefault: true,
            }),
          ),
        });
        const sectionMap = new Map(
          sections.map((section) => [section.jwId, section.id]),
        );
        const groupMap = new Map(groups.map((group) => [group.jwId, group.id]));
        const build = (section: (typeof sections)[number]): ScheduleBuild => ({
          periods: 2,
          weekday: 1,
          startTime: 750,
          endTime: 925,
          weekIndex: 1,
          startUnit: 1,
          endUnit: 2,
          lessonJwId: section.jwId,
          scheduleGroupJwId: section.jwId,
          teacherParticipations: [],
        });
        await writeSchedules(
          tx,
          [build(staleSection), build(keptSection), build(uncoveredSection)],
          sectionMap,
          groupMap,
          new Map(),
          new Map(),
          sections.map((section) => section.id),
        );
        const before = await tx.schedule.findMany({
          where: { sectionId: { in: [keptSection.id, uncoveredSection.id] } },
          orderBy: { id: "asc" },
        });
        const tuples = await Promise.all(
          before.map((row) => tupleId(tx, "Schedule", `"id" = ${row.id}`)),
        );
        // The first 500 sections now have no schedules. The retained meeting is
        // in the second batch; the last section is outside this source's scope.
        await writeSchedules(
          tx,
          [build(keptSection)],
          sectionMap,
          groupMap,
          new Map(),
          new Map(),
          sections.slice(0, 501).map((section) => section.id),
        );
        expect(
          await tx.schedule.count({ where: { sectionId: staleSection.id } }),
        ).toBe(0);
        expect(
          await tx.schedule.findMany({
            where: { sectionId: { in: [keptSection.id, uncoveredSection.id] } },
            orderBy: { id: "asc" },
          }),
        ).toEqual(before);
        expect(
          await Promise.all(
            before.map((row) => tupleId(tx, "Schedule", `"id" = ${row.id}`)),
          ),
        ).toEqual(tuples);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
    expect(await prisma.course.count({ where: { jwId: marker } })).toBe(0);
  });

  it("does not rebuild unchanged section relation rows", async () => {
    const rollback = new Error("ROLLBACK_SECTION_JOIN_CHURN_TEST");
    const marker = 1_900_000_000 + (Date.now() % 100_000_000);

    try {
      await prisma.$transaction(async (tx) => {
        const course = await tx.course.create({
          data: {
            jwId: marker,
            code: `${marker}`,
            nameCn: `${marker}`,
          },
        });
        const section = await tx.section.create({
          data: {
            jwId: marker,
            code: `${marker}`,
            courseId: course.id,
          },
        });
        const department = await tx.department.create({
          data: { code: `${marker}`, nameCn: `${marker}` },
        });
        const teacher = await tx.teacher.create({
          data: {
            jwId: marker,
            personId: marker,
            code: `${marker}`,
            nameCn: `${marker}`,
            departmentId: department.id,
          },
        });
        const adminClass = await tx.adminClass.create({
          data: { jwId: marker, nameCn: `${marker}` },
        });
        const sectionMap = new Map([[section.jwId, section.id]]);
        const teacherMap = new Map([[marker, teacher.id]]);
        const teacherPairs = [
          {
            sectionJwId: section.jwId,
            teacherJwId: marker,
          },
        ];
        const adminPairs = [
          {
            sectionJwId: section.jwId,
            adminClassJwId: marker,
          },
        ];

        await writeSectionTeachers(tx, sectionMap, teacherMap, teacherPairs, [
          section.id,
        ]);
        await writeAdminClassSections(
          tx,
          adminPairs,
          sectionMap,
          new Map([[marker, adminClass.id]]),
        );
        const status = await tx.sectionTeacher.findFirstOrThrow({
          where: { sectionId: section.id, teacherId: teacher.id },
        });
        const teacherJoinTuple = await tupleId(
          tx,
          "_SectionTeachers",
          `"A" = ${section.id}`,
        );
        const adminJoinTuple = await tupleId(
          tx,
          "_SectionAdminClasses",
          `"B" = ${section.id}`,
        );

        await writeSectionTeachers(tx, sectionMap, teacherMap, teacherPairs, [
          section.id,
        ]);
        await writeAdminClassSections(
          tx,
          adminPairs,
          sectionMap,
          new Map([[marker, adminClass.id]]),
        );

        await expect(
          tx.sectionTeacher.findFirstOrThrow({
            where: { sectionId: section.id, teacherId: teacher.id },
            select: { updatedAt: true },
          }),
        ).resolves.toEqual({ updatedAt: status.updatedAt });
        expect(
          await tupleId(tx, "_SectionTeachers", `"A" = ${section.id}`),
        ).toBe(teacherJoinTuple);
        expect(
          await tupleId(tx, "_SectionAdminClasses", `"B" = ${section.id}`),
        ).toBe(adminJoinTuple);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});

describe("Young source reconciliation", () => {
  it("does not let a newer curriculum snapshot replay stale Young data", async () => {
    const rollback = new Error("rollback stale Young snapshot");
    try {
      await prisma.$transaction(async (tx) => {
        const seen = new Date("2030-01-01T00:00:00Z");
        await tx.staticImportState.upsert({
          where: { id: "global" },
          create: {
            id: "global",
            snapshotGeneratedAt: seen,
            youngSyncedAt: seen,
            snapshotSha256: "a".repeat(64),
            transformRevision: 4,
          },
          update: { youngSyncedAt: seen },
        });
        const row = await tx.youngEvent.create({
          data: {
            youngId: crypto.randomUUID(),
            name: "newer activity",
            rawJson: {},
            isActive: true,
            lastSeenAt: seen,
          },
        });
        for (const date of [
          undefined,
          seen,
          new Date("2029-12-01T00:00:00Z"),
        ]) {
          expect(await syncYoungSnapshot(tx, [], date)).toBeUndefined();
        }
        expect(
          await tx.youngEvent.findUnique({ where: { id: row.id } }),
        ).toMatchObject({ sourceMissing: false, lastSeenAt: seen });
        expect(
          await tx.staticImportState.findUnique({ where: { id: "global" } }),
        ).toMatchObject({ youngSyncedAt: seen });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
  it("preserves the last seen timestamp and rows when a complete snapshot omits an activity", async () => {
    const rollback = new Error("rollback young fixture");
    try {
      await prisma.$transaction(async (tx) => {
        const marker = `young-reconciliation-${crypto.randomUUID()}`;
        const seen = new Date("2030-01-01T00:00:00Z");
        const row = await tx.youngEvent.create({
          data: {
            youngId: marker,
            name: marker,
            rawJson: {},
            isActive: true,
            lastSeenAt: seen,
          },
        });
        await syncYoungEvents(tx, [], {
          observedAt: new Date("2030-02-01T00:00:00Z"),
          complete: false,
        });
        expect(
          await tx.youngEvent.findUnique({ where: { id: row.id } }),
        ).toMatchObject({ sourceMissing: false, lastSeenAt: seen });
        await syncYoungEvents(tx, [], {
          observedAt: new Date("2030-02-01T00:00:00Z"),
          complete: true,
        });
        expect(
          await tx.youngEvent.findUnique({ where: { id: row.id } }),
        ).toMatchObject({ sourceMissing: true, lastSeenAt: seen });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});

it("round-trips Young participation arrays and clears removed facts without rewriting unchanged rows", async () => {
  const rollback = new Error("ROLLBACK_YOUNG_METADATA");
  try {
    await prisma.$transaction(async (tx) => {
      const youngId = `metadata-${crypto.randomUUID()}`;
      const observedAt = new Date("2026-09-24T00:00:00Z");
      const build = {
        youngId,
        name: "Metadata import",
        isActive: true,
        rawJson: "{}",
        categoryCode: "0",
        departmentId: "dept-1",
        upstreamOrganizerIds: ["o1", "o2"],
        upstreamSponsorIds: ["s1"],
        tagIds: ["t1", "t2"],
        signupScopeCode: "2",
        signupDepartmentIds: ["d1"],
        requiresSignupInfo: false,
        allowedAttachmentTypes: ["pdf", "docx"],
        isOnline: true,
        onlineMeetingInfo: "800-414-186",
        externalSponsor: "Partner",
      };
      await syncYoungEvents(tx, [build], { observedAt });
      const first = await tx.youngEvent.findUniqueOrThrow({
        where: { youngId },
      });
      expect(first).toMatchObject({ ...build, rawJson: {} });
      const before = await tupleId(tx, "YoungEvent", `id = ${first.id}`);
      await syncYoungEvents(tx, [build], { observedAt });
      expect(await tupleId(tx, "YoungEvent", `id = ${first.id}`)).toBe(before);
      await syncYoungEvents(
        tx,
        [{ youngId, name: build.name, isActive: true, rawJson: "{}" }],
        { observedAt },
      );
      expect(
        await tx.youngEvent.findUniqueOrThrow({ where: { youngId } }),
      ).toMatchObject({
        tagIds: [],
        allowedAttachmentTypes: [],
        upstreamOrganizerIds: [],
        requiresSignupInfo: null,
        isOnline: null,
        externalSponsor: null,
      });
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
});
