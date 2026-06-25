import {
  createToolPrisma,
  disconnectToolPrisma,
} from "@tools/shared/tool-prisma";
import { afterAll, describe, expect, it } from "vitest";
import { replaceSectionTeachers } from "../../tools/load/static-course-persistence";

const prisma = createToolPrisma();

function marker(prefix: string) {
  return `[integration-test] ${prefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function uniqueJwId() {
  return 1_900_000_000 + Math.floor(Math.random() * 100_000_000);
}

afterAll(async () => {
  await disconnectToolPrisma(prisma);
});

describe("static course persistence", () => {
  it("keeps implicit section teachers and explicit comment targets aligned", async () => {
    const prefix = marker("static-section-teachers");
    const course = await prisma.course.create({
      data: {
        jwId: uniqueJwId(),
        code: prefix,
        nameCn: prefix,
      },
      select: { id: true },
    });
    const section = await prisma.section.create({
      data: {
        jwId: uniqueJwId(),
        code: "001",
        courseId: course.id,
      },
      select: { id: true },
    });
    const [firstTeacher, secondTeacher] = await Promise.all([
      prisma.teacher.create({
        data: { nameCn: `${prefix} first` },
        select: { id: true },
      }),
      prisma.teacher.create({
        data: { nameCn: `${prefix} second` },
        select: { id: true },
      }),
    ]);

    try {
      await replaceSectionTeachers(
        prisma,
        [section.id],
        [
          { sectionId: section.id, teacherId: firstTeacher.id },
          { sectionId: section.id, teacherId: secondTeacher.id },
        ],
      );

      const linked = await prisma.section.findUniqueOrThrow({
        where: { id: section.id },
        select: {
          teachers: { orderBy: { id: "asc" }, select: { id: true } },
          sectionTeachers: {
            orderBy: { teacherId: "asc" },
            select: { teacherId: true, retiredAt: true },
          },
        },
      });
      expect(linked.teachers.map((teacher) => teacher.id)).toEqual(
        [firstTeacher.id, secondTeacher.id].sort((left, right) => left - right),
      );
      expect(linked.sectionTeachers).toEqual([
        { teacherId: firstTeacher.id, retiredAt: null },
        { teacherId: secondTeacher.id, retiredAt: null },
      ]);

      await replaceSectionTeachers(
        prisma,
        [section.id],
        [{ sectionId: section.id, teacherId: secondTeacher.id }],
      );

      const replaced = await prisma.section.findUniqueOrThrow({
        where: { id: section.id },
        select: {
          teachers: { select: { id: true } },
          sectionTeachers: {
            orderBy: { teacherId: "asc" },
            select: { teacherId: true, retiredAt: true },
          },
        },
      });
      expect(replaced.teachers).toEqual([{ id: secondTeacher.id }]);
      expect(replaced.sectionTeachers).toHaveLength(2);
      expect(
        replaced.sectionTeachers.find(
          (target) => target.teacherId === firstTeacher.id,
        )?.retiredAt,
      ).toBeInstanceOf(Date);
      expect(
        replaced.sectionTeachers.find(
          (target) => target.teacherId === secondTeacher.id,
        )?.retiredAt,
      ).toBeNull();
    } finally {
      await prisma.section.deleteMany({ where: { id: section.id } });
      await prisma.teacher.deleteMany({
        where: { id: { in: [firstTeacher.id, secondTeacher.id] } },
      });
      await prisma.course.deleteMany({ where: { id: course.id } });
    }
  });
});
