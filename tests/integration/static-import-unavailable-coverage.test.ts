import { afterAll, describe, expect, it, vi } from "vitest";
import type { Prisma, PrismaClient } from "@/generated/prisma-node/client";
import type { SnapshotRow } from "@/static-loader/snapshot-values";
import { createFixturePrisma, disconnectTestPrisma } from "../shared/prisma";

const { tables, metadata } = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  metadata: {} as Record<string, string>,
}));

vi.mock("@/static-loader/snapshot", () => ({
  Snapshot: class {
    metadata() {
      return metadata;
    }
    queryAll(table: string) {
      return tables[table] ?? [];
    }
    queryGrouped(table: string, parentColumn = "parent_store_id") {
      const grouped = new Map<number, SnapshotRow[]>();
      for (const row of tables[table] ?? []) {
        const parent = Number(row[parentColumn]);
        if (!Number.isInteger(parent)) continue;
        const children = grouped.get(parent) ?? [];
        children.push(row);
        grouped.set(parent, children);
      }
      return grouped;
    }
    hasTable(table: string) {
      return table in tables;
    }
    close() {}
  },
}));

const prisma = createFixturePrisma();
afterAll(() => disconnectTestPrisma(prisma));

describe("unavailable static sources", () => {
  it("preserves unavailable curriculum and exams while importing available curriculum", async () => {
    const { runImport } = await import("@/static-loader/import");
    const rollback = new Error("ROLLBACK_UNAVAILABLE_STATIC_SOURCES_TEST");
    const marker = 1_941_000_000;
    const unavailableSemester = marker;
    const availableSemester = marker + 1;
    Object.assign(metadata, {
      schema_version: "6",
      generated_at: "2026-09-25T00:00:00.000Z",
      catalog_lesson_min_semester_id: String(marker),
      catalog_exam_min_semester_id: String(marker),
      curriculum_unavailable_semester_ids: String(unavailableSemester),
      catalog_exam_unavailable_semester_ids: String(availableSemester),
      jw_schedule_chunk_size: "100",
    });
    tables.jw_room_types = [];
    tables.catalog_teach_semester_list = [
      unavailableSemester,
      availableSemester,
    ].map((id) => ({
      id,
      code: String(id),
      nameZh: `[integration-test] semester ${id}`,
    }));
    tables.catalog_teach_lesson_list_for_teach = [
      {
        id: marker + 21,
        store_id: 1,
        semester_id: availableSemester,
        code: "refreshed-section",
        period: 48,
      },
    ];
    tables.catalog_teach_lesson_list_for_teach_course = [
      {
        parent_store_id: 1,
        id: marker + 10,
        cn: "[integration-test] available curriculum",
        code: String(marker + 10),
      },
    ];
    tables.jw_ws_schedule_table_datum_result_lessonList = [
      {
        id: marker + 21,
        store_id: 1,
        semester_id: availableSemester,
      },
    ];
    tables.upstream_fetches = [
      {
        source: "catalog_teach_lesson_list_for_teach",
        context: `semester_id=${unavailableSemester}`,
        ok: false,
      },
      {
        source: "catalog_teach_lesson_list_for_teach",
        context: `semester_id=${availableSemester}`,
        ok: true,
      },
      {
        source: "jw_ws_schedule_table_datum",
        context: `semester_id=${availableSemester}&chunk_index=0`,
        ok: true,
      },
      {
        source: "catalog_teach_exam_list",
        context: `semester_id=${availableSemester}`,
        ok: false,
      },
    ];
    // Even residual cached exam rows cannot overwrite data when that source
    // is explicitly unavailable for this snapshot.
    tables.catalog_teach_exam_list = [0, 1].map((index) => ({
      id: marker + 30 + index,
      store_id: index + 1,
      examTakeCount: 999,
    }));
    tables.catalog_teach_exam_list_lesson = [0, 1].map((index) => ({
      parent_store_id: index + 1,
      id: marker + 20 + index,
    }));
    tables.catalog_teach_exam_list_examRooms = [0, 1].map((index) => ({
      parent_store_id: index + 1,
      room: "stale-source-room",
      count: 999,
    }));

    try {
      await prisma.$transaction(async (tx) => {
        await tx.staticImportState.deleteMany({ where: { id: "global" } });
        const course = await tx.course.create({
          data: {
            jwId: marker + 10,
            code: String(marker + 10),
            nameCn: "[integration-test] original course",
          },
        });
        const sections = [];
        for (const [index, jwId] of [
          unavailableSemester,
          availableSemester,
        ].entries()) {
          const semester = await tx.semester.create({
            data: {
              jwId,
              code: String(jwId),
              nameCn: "[integration-test] source unavailable",
            },
          });
          sections.push(
            await tx.section.create({
              data: {
                jwId: marker + 20 + index,
                code: "original-section",
                period: 16,
                semesterId: semester.id,
                courseId: course.id,
                exams: {
                  create: {
                    jwId: marker + 30 + index,
                    examTakeCount: 20,
                    examRooms: { create: { room: "original-room", count: 20 } },
                  },
                },
              },
            }),
          );
        }
        const teacher = await tx.teacher.create({
          data: {
            jwId: marker + 40,
            personId: marker + 40,
            nameCn: "[integration-test] original teacher",
          },
        });
        await tx.section.update({
          where: { id: sections[0].id },
          data: {
            teachers: { connect: { id: teacher.id } },
            sectionTeachers: { create: { teacherId: teacher.id } },
            teacherAssignments: {
              create: { teacherId: teacher.id, period: 1.5 },
            },
          },
        });
        const group = await tx.scheduleGroup.create({
          data: {
            jwId: marker + 50,
            sectionId: sections[0].id,
            no: 1,
            limitCount: 30,
            stdCount: 20,
            actualPeriods: 16,
            isDefault: true,
          },
        });
        await tx.schedule.create({
          data: {
            sectionId: sections[0].id,
            scheduleGroupId: group.id,
            periods: 2,
            weekday: 1,
            startTime: 750,
            endTime: 925,
            weekIndex: 1,
            startUnit: 1,
            endUnit: 2,
            teacherParticipations: { create: { teacherId: teacher.id } },
          },
        });
        const include = {
          teachers: true,
          sectionTeachers: true,
          teacherAssignments: true,
          scheduleGroups: true,
          schedules: {
            include: { teacherParticipations: { include: { teacher: true } } },
          },
          exams: { include: { examRooms: true } },
        } satisfies Prisma.SectionInclude;
        const before = await tx.section.findUniqueOrThrow({
          where: { id: sections[0].id },
          include,
        });
        const preservedExam = await tx.exam.findUniqueOrThrow({
          where: { jwId: marker + 31 },
          include: { examRooms: true },
        });
        const transactionClient = {
          $transaction: (
            callback: (
              transaction: Prisma.TransactionClient,
            ) => Promise<unknown>,
          ) => callback(tx),
        } as unknown as PrismaClient;
        const config = {
          snapshotPath: "/mocked-unavailable.sqlite",
          snapshotSha256: "d".repeat(64),
          dryRun: false,
        };
        const report = await runImport(transactionClient, config);
        expect(report).toMatchObject({
          outcome: "committed",
          sourceAvailability: {
            unavailableCurriculumSemesterJwIds: [unavailableSemester],
            unavailableExamSemesterJwIds: [availableSemester],
          },
          plannedRecordCounts: { sections: 1, exams: 0 },
          reconciliation: {
            sectionPresence: {
              scopeSemesterCount: 1,
              seenSectionCount: 1,
              deactivatedCount: 0,
            },
          },
        });
        expect(
          await tx.section.findUniqueOrThrow({
            where: { id: sections[0].id },
            include,
          }),
        ).toEqual(before);
        expect(
          await tx.section.findUniqueOrThrow({ where: { id: sections[1].id } }),
        ).toMatchObject({
          code: "refreshed-section",
          period: 48,
          retiredAt: null,
        });
        expect(
          await tx.exam.findUniqueOrThrow({
            where: { jwId: marker + 31 },
            include: { examRooms: true },
          }),
        ).toEqual(preservedExam);
        expect(await runImport(transactionClient, config)).toMatchObject({
          outcome: "unchanged",
          sourceAvailability: report.sourceAvailability,
        });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
