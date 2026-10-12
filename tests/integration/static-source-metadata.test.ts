import { describe } from "vitest";
import {
  sectionInclude,
  teacherAssignmentPublicSelect,
  teacherPublicReferenceSelect,
} from "@/features/catalog/server/academic-query-includes";
import { toSectionDetailDto } from "@/features/catalog/server/course-section-read-queries";
import { prisma as appPrisma } from "@/lib/db/prisma";
import { upsertExams, upsertSections } from "@/static-loader/import-sections";
import {
  type ExamBuild,
  mapExam,
  type SectionBuild,
} from "@/static-loader/mappers";
import { staticImporterTest as it } from "../shared/static-importer-fixture";

describe("academic source metadata persistence", () => {
  it("section.source-planning-metadata", {
    tags: ["@StaticImport/Service"],
  }, async ({
    isolatedDatabase: { owner: db },
    importer,
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const marker = 1;
      const { semester, course } = await db.$transaction(async (tx) => {
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
        return { semester, course };
      });
      const build: SectionBuild = {
        jwId: marker,
        code: "TEST.01",
        courseJwId: marker,
        semesterCode: marker,
        requiredWeeks: 18,
        catalogAdminClasses: [{ nameCn: "源行政班", nameEn: null }],
      };
      const sectionMap = await importer.$transaction((tx) =>
        upsertSections(
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
        ),
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
      await importer.$transaction((tx) =>
        upsertExams(tx, [exam], sectionMap, new Map()),
      );
      const read = () =>
        protocolRuntime.request(() =>
          appPrisma.section.findUniqueOrThrow({
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
          }),
        );
      const dto = toSectionDetailDto(await read(), "zh-cn");
      expect(dto.requiredWeeks).toBe(18);
      expect(dto.catalogAdminClasses).toEqual(build.catalogAdminClasses);
      expect(dto.adminClasses).toEqual([]);
      expect(dto.exams[0]).toMatchObject({
        grades: exam.grades,
        adminClassNames: exam.adminClassNames,
        monitors: exam.monitors,
      });
      await importer.$transaction((tx) =>
        upsertExams(
          tx,
          [{ jwId: marker, sectionJwId: marker, rooms: [] }],
          sectionMap,
          new Map(),
        ),
      );
      expect(toSectionDetailDto(await read(), "zh-cn").exams[0]).toMatchObject({
        grades: null,
        adminClassNames: null,
        monitors: [],
      });
    });
  });
});

it("exam.source-audience-and-monitors", {
  tags: ["@StaticImport/Service"],
}, async ({
  isolatedDatabase: { owner: db },
  importer,
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const marker = 1;
    const section = await db.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          jwId: marker,
          code: String(marker),
          nameCn: "Monitor identity test",
        },
      });
      const section = await tx.section.create({
        data: { jwId: marker, code: String(marker), courseId: course.id },
      });
      return section;
    });
    const mapped = mapExam(
      { id: marker, grades: "2025,2026", adminclasseNames: "Source class" },
      { id: marker },
      undefined,
      [],
      [
        {
          id: 123,
          cn: "Same name",
          en: "Monitor",
          email: "must-not-publish@example.test",
          userId: "must-not-link",
        },
        { id: 456, cn: "Same name" },
        { id: 789 },
      ],
    );
    if (!mapped) throw new Error("Expected exam mapping");
    expect(() =>
      mapExam(
        { id: marker },
        { id: marker },
        undefined,
        [],
        [{ cn: "Same name" }],
      ),
    ).toThrow("no upstream identity");
    const expected = [
      { jwId: 123, nameCn: "Same name", nameEn: "Monitor" },
      { jwId: 456, nameCn: "Same name", nameEn: null },
      { jwId: 789, nameCn: null, nameEn: null },
    ];
    expect(mapped.monitors).toEqual(expected);
    await importer.$transaction((tx) =>
      upsertExams(tx, [mapped], new Map([[marker, section.id]]), new Map()),
    );
    const read = () =>
      protocolRuntime.request(() =>
        appPrisma.section.findUniqueOrThrow({
          where: { id: section.id },
          include: {
            ...sectionInclude,
            roomType: true,
            schedules: true,
            scheduleGroups: true,
            teachers: { select: teacherPublicReferenceSelect },
            teacherAssignments: { select: teacherAssignmentPublicSelect },
            exams: { include: { examBatch: true, examRooms: true } },
          },
        }),
      );
    for (const locale of ["zh-cn", "en-us"] as const) {
      const exam = toSectionDetailDto(await read(), locale).exams[0];
      expect(exam.grades).toBe("2025,2026");
      expect(exam.adminClassNames).toBe("Source class");
      expect(exam.monitors).toEqual(expected);
    }
    expect(await db.teacher.count({ where: { nameCn: "Same name" } })).toBe(0);
    await importer.$transaction((tx) =>
      upsertExams(
        tx,
        [{ jwId: marker, sectionJwId: marker, rooms: [] }],
        new Map([[marker, section.id]]),
        new Map(),
      ),
    );
    expect(toSectionDetailDto(await read(), "zh-cn").exams[0]).toMatchObject({
      grades: null,
      adminClassNames: null,
      monitors: [],
    });
  });
});
