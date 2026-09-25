import { afterAll, describe, expect, it } from "vitest";
import {
  sectionInclude,
  teacherAssignmentPublicSelect,
  teacherPublicReferenceSelect,
} from "@/features/catalog/server/academic-query-includes";
import { toSectionDetailDto } from "@/features/catalog/server/course-section-read-queries";
import { upsertExams, upsertSections } from "@/static-loader/import-sections";
import type { ExamBuild, SectionBuild } from "@/static-loader/mappers";
import { createFixturePrisma, disconnectTestPrisma } from "../shared/prisma";

const prisma = createFixturePrisma();
afterAll(() => disconnectTestPrisma(prisma));

describe("academic source metadata persistence", () => {
  it("imports and reads metadata, then clears values removed from the source", async () => {
    const rollback = new Error("ROLLBACK_SOURCE_METADATA_TEST");
    const marker = 2_130_000_000 + (Date.now() % 1_000_000);
    try {
      await prisma.$transaction(async (tx) => {
        const semester = await tx.semester.create({
          data: {
            jwId: marker,
            code: `metadata-${marker}`,
            nameCn: "测试学期",
          },
        });
        const course = await tx.course.create({
          data: {
            jwId: marker,
            code: `metadata-${marker}`,
            nameCn: "测试课程",
          },
        });
        const build: SectionBuild = {
          jwId: marker,
          code: "TEST.01",
          courseJwId: marker,
          semesterCode: marker,
          requiredWeeks: 18,
          catalogAdminClasses: [{ nameCn: "源行政班", nameEn: null }],
        };
        const sectionMap = await upsertSections(
          tx,
          [build],
          new Map([[marker, semester.id]]),
          new Map(),
          new Map([[marker, course.id]]),
          {
            courseCategory: new Map(),
            courseClassify: new Map(),
            courseGradation: new Map(),
            courseType: new Map(),
            educationLevel: new Map(),
            classType: new Map(),
            examMode: new Map(),
            teachLanguage: new Map(),
          },
          new Map(),
          new Map(),
        );
        const exam: ExamBuild = {
          jwId: marker,
          sectionJwId: marker,
          rooms: [],
          grades: "2021,2022",
          adminClassNames: "源行政班",
          monitors: [
            { jwId: 12345, nameCn: "监考教师", nameEn: "Test Monitor" },
            { jwId: 8535, nameCn: null, nameEn: null },
          ],
        };
        await upsertExams(tx, [exam], sectionMap, new Map());
        const read = () =>
          tx.section.findUniqueOrThrow({
            where: { jwId: marker },
            include: {
              ...sectionInclude,
              roomType: true,
              schedules: true,
              scheduleGroups: true,
              teachers: { select: teacherPublicReferenceSelect },
              teacherAssignments: { select: teacherAssignmentPublicSelect },
              exams: { include: { examBatch: true, examRooms: true } },
            },
          });
        const dto = toSectionDetailDto(await read(), "zh-cn");
        expect(dto.requiredWeeks).toBe(18);
        expect(dto.catalogAdminClasses).toEqual(build.catalogAdminClasses);
        expect(dto.adminClasses).toEqual([]);
        expect(dto.exams[0]).toMatchObject({
          grades: exam.grades,
          adminClassNames: exam.adminClassNames,
          monitors: exam.monitors,
        });
        await upsertExams(
          tx,
          [{ jwId: marker, sectionJwId: marker, rooms: [] }],
          sectionMap,
          new Map(),
        );
        expect(
          toSectionDetailDto(await read(), "zh-cn").exams[0],
        ).toMatchObject({ grades: null, adminClassNames: null, monitors: [] });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
