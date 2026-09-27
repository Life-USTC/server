import { afterAll, expect, it } from "vitest";
import { findSectionDetailByJwId } from "@/features/catalog/server/course-section-read-queries";
import { teacherAssignmentSchema } from "@/lib/api/schemas/academic-teacher-assignment-response-schemas";
import { createFixturePrisma } from "../shared/prisma";

const fixture = createFixturePrisma();
afterAll(() => fixture.$disconnect());
it("section.teacher-assignment-reference", async () => {
  const jwId = 1700000000 + Math.floor(Math.random() * 100000000);
  const course = await fixture.course.create({
    data: { jwId, code: `assignment-${jwId}`, nameCn: "引用课程" },
  });
  const semester = await fixture.semester.create({
    data: { jwId, code: `assignment-${jwId}`, nameCn: "引用学期" },
  });
  const teacher = await fixture.teacher.create({
    data: {
      jwId,
      nameCn: "引用教师",
      nameEn: "Referenced teacher",
      email: "private-assignment@example.test",
      mobile: "private-assignment-mobile",
    },
  });
  const section = await fixture.section.create({
    data: {
      jwId,
      code: "REFERENCE.01",
      courseId: course.id,
      semesterId: semester.id,
      teachers: { connect: { id: teacher.id } },
    },
  });
  try {
    const assignment = await fixture.teacherAssignment.create({
      data: {
        sectionId: section.id,
        teacherId: teacher.id,
        period: 1.5,
        role: "lecturer",
        weekIndices: [1, 3],
        weekIndicesMsg: "Odd weeks",
      },
    });
    for (const locale of ["zh-cn", "en-us"] as const) {
      // Public service resolves its normal restricted runtime connection.
      const detail = await findSectionDetailByJwId(jwId, locale);
      expect(detail?.teacherAssignments).toEqual([
        {
          id: assignment.id,
          sectionId: section.id,
          teacherId: teacher.id,
          period: 1.5,
          role: "lecturer",
          weekIndices: [1, 3],
          weekIndicesMsg: "Odd weeks",
          teacherLessonTypeId: null,
          teacherTitleId: null,
          teacherLessonType: null,
          teacherTitle: null,
        },
      ]);
      expect(
        teacherAssignmentSchema.parse(detail?.teacherAssignments[0]),
      ).toEqual(detail?.teacherAssignments[0]);
      expect(detail?.teacherAssignments[0]).not.toHaveProperty("teacher");
      expect(detail?.teachers).toEqual([
        expect.objectContaining({
          id: teacher.id,
          namePrimary: locale === "en-us" ? teacher.nameEn : teacher.nameCn,
        }),
      ]);
      expect(JSON.stringify(detail)).not.toContain("private-assignment");
    }
  } finally {
    await fixture.teacherAssignment.deleteMany({
      where: { sectionId: section.id },
    });
    await fixture.section.delete({ where: { id: section.id } });
    await fixture.teacher.delete({ where: { id: teacher.id } });
    await fixture.course.delete({ where: { id: course.id } });
    await fixture.semester.delete({ where: { id: semester.id } });
  }
});
