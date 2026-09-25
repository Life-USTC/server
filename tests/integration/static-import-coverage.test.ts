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

describe("static import source coverage", () => {
  it("preserves uncovered history, reconciles fetched exams, and retires a fetched empty semester", async () => {
    const { runImport } = await import("@/static-loader/import");
    const rollback = new Error("ROLLBACK_STATIC_IMPORT_COVERAGE_TEST");
    const marker = 1_940_000_000;
    const observedAt = new Date("2026-09-25T00:00:00.000Z");
    const snapshotSha256 = "c".repeat(64);
    // Outside coverage; legacy with no exams fetched; legacy fetched empty;
    // current exams fetched; catalog fetched empty.
    const semesterJwIds = [0, 1, 2, 3, 4].map((offset) => marker + offset);
    const importedSemesters = semesterJwIds.slice(1, 4);
    const courseJwId = marker + 10;
    const sectionJwIds = semesterJwIds.map((semester) => semester + 20);
    Object.assign(metadata, {
      schema_version: "5",
      generated_at: observedAt.toISOString(),
      catalog_lesson_min_semester_id: String(semesterJwIds[1]),
      catalog_exam_min_semester_id: String(semesterJwIds[3]),
      jw_schedule_chunk_size: "100",
    });
    tables.catalog_teach_semester_list = semesterJwIds.map((id) => ({
      id,
      code: String(id),
      nameZh: `[integration-test] semester ${id}`,
    }));
    tables.catalog_teach_lesson_list_for_teach = importedSemesters.map(
      (semester_id) => ({
        id: semester_id + 20,
        store_id: semester_id,
        semester_id,
        code: String(semester_id),
      }),
    );
    tables.catalog_teach_lesson_list_for_teach_course = importedSemesters.map(
      (parent_store_id) => ({
        parent_store_id,
        id: courseJwId,
        cn: "[integration-test] coverage",
        code: String(courseJwId),
      }),
    );
    tables.jw_ws_schedule_table_datum_result_lessonList = importedSemesters.map(
      (semester_id) => ({
        id: semester_id + 20,
        store_id: semester_id,
        semester_id,
      }),
    );
    tables.upstream_fetches = semesterJwIds.slice(1).flatMap((semester) => [
      {
        source: "catalog_teach_lesson_list_for_teach",
        context: `semester_id=${semester}`,
        ok: true,
      },
      ...(semester === semesterJwIds[4]
        ? []
        : [
            {
              source: "jw_ws_schedule_table_datum",
              context: `semester_id=${semester}&chunk_index=0`,
              ok: true,
            },
          ]),
      ...(semester === semesterJwIds[1]
        ? []
        : [
            {
              source: "catalog_teach_exam_list",
              context: `semester_id=${semester}`,
              ok: true,
            },
          ]),
    ]);
    const coveredExamJwId = marker + 33;
    tables.catalog_teach_exam_list = [
      {
        id: coveredExamJwId,
        store_id: 1,
        examTakeCount: 25,
        startTime: 900,
        endTime: 1100,
      },
    ];
    tables.catalog_teach_exam_list_lesson = [
      { parent_store_id: 1, id: sectionJwIds[3] },
    ];
    tables.catalog_teach_exam_list_examRooms = [
      { parent_store_id: 1, room: "new-room", count: 25 },
    ];

    try {
      await prisma.$transaction(async (tx) => {
        await tx.staticImportState.deleteMany({ where: { id: "global" } });
        const course = await tx.course.create({
          data: {
            jwId: courseJwId,
            code: String(courseJwId),
            nameCn: "[integration-test] coverage",
          },
        });
        const sections = [];
        const exams = [];
        for (const [index, semesterJwId] of semesterJwIds.entries()) {
          const semester = await tx.semester.create({
            data: {
              jwId: semesterJwId,
              code: String(semesterJwId),
              nameCn: "[integration-test] coverage",
            },
          });
          const section = await tx.section.create({
            data: {
              jwId: sectionJwIds[index],
              code: String(semesterJwId),
              courseId: course.id,
              semesterId: semester.id,
            },
          });
          sections.push(section);
          exams.push(
            await tx.exam.create({
              data: {
                jwId: marker + 30 + index,
                sectionId: section.id,
                examTakeCount: 1,
                examRooms: { create: { room: "old-room", count: 1 } },
              },
              include: { examRooms: true },
            }),
          );
        }
        const omittedCoveredExam = await tx.exam.create({
          data: {
            jwId: marker + 40,
            sectionId: sections[3].id,
            examRooms: { create: { room: "obsolete-room", count: 1 } },
          },
        });
        // Run the actual importer against the same real transaction so its
        // catalog writes and global state roll back along with the fixtures.
        const transactionClient = {
          $transaction: (
            callback: (
              transaction: Prisma.TransactionClient,
            ) => Promise<unknown>,
          ) => callback(tx),
        } as unknown as PrismaClient;
        const config = {
          snapshotPath: "/mocked-coverage.sqlite",
          snapshotSha256,
          dryRun: false,
        };
        const failedFetch = {
          source: "catalog_teach_exam_list",
          context: `semester_id=${semesterJwIds[1]}`,
          ok: false,
        };
        tables.upstream_fetches.push(failedFetch);
        await expect(runImport(transactionClient, config)).rejects.toThrow(
          "failed",
        );
        expect(
          await tx.staticImportState.findUnique({ where: { id: "global" } }),
        ).toBeNull();
        expect(
          await tx.exam.findUnique({ where: { id: exams[2].id } }),
        ).not.toBeNull();
        tables.upstream_fetches.pop();

        const report = await runImport(transactionClient, config);
        expect(report.outcome).toBe("committed");
        expect(report.reconciliation.sectionPresence).toMatchObject({
          scopeSemesterCount: 4,
          seenSectionCount: 3,
          deactivatedCount: 1,
        });
        for (const index of [0, 1]) {
          expect(
            await tx.exam.findUnique({
              where: { id: exams[index].id },
              include: { examRooms: true },
            }),
          ).toEqual(exams[index]);
        }
        expect(
          await tx.exam.findUnique({ where: { id: exams[2].id } }),
        ).toBeNull();
        expect(
          await tx.examRoom.count({ where: { examId: exams[2].id } }),
        ).toBe(0);
        expect(
          await tx.exam.findUnique({ where: { id: omittedCoveredExam.id } }),
        ).toBeNull();
        expect(
          await tx.examRoom.count({ where: { examId: omittedCoveredExam.id } }),
        ).toBe(0);
        expect(
          await tx.exam.findUnique({
            where: { id: exams[3].id },
            include: { examRooms: true },
          }),
        ).toMatchObject({
          jwId: coveredExamJwId,
          examTakeCount: 25,
          startTime: 900,
          endTime: 1100,
          examRooms: [{ room: "new-room", count: 25 }],
        });
        expect(
          await tx.section.findUnique({ where: { id: sections[4].id } }),
        ).toMatchObject({ retiredAt: observedAt });
        expect(
          await tx.section.findUnique({ where: { id: sections[0].id } }),
        ).toMatchObject({ retiredAt: null });
        expect(await runImport(transactionClient, config)).toMatchObject({
          outcome: "unchanged",
        });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
