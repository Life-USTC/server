import { expect } from "vitest";
import { getCoursePage } from "@/features/catalog/server/course-page-data";
import { findCourseDetailByJwId } from "@/features/catalog/server/course-section-read-queries";
import { listSectionHistory } from "@/features/catalog/server/section-history-read-model";
import { getTeacherPage } from "@/features/catalog/server/teacher-page-data";
import { findTeacherDetailById } from "@/features/catalog/server/teacher-summary-read-model";
import { catalogReadTest as it } from "../shared/catalog-read-fixture";

it("catalog.history-chronology", {
  tags: ["@Course/Service", "@Teacher/Service"],
}, async ({ catalogRead: { run, db, fixture, request } }) => {
  await run(async () => {
    const [course] = fixture.courses;
    const [teacher] = fixture.teachers;
    await db.section.deleteMany({ where: { courseId: course.id } });
    const dates = ["2009-09-01", "2006-09-01", "2005-09-01", null];
    const upstreamIds = [47, 48, 31, 999];
    const expected: number[] = [];
    for (const [termIndex, day] of dates.entries()) {
      const semester = await db.semester.create({
        data: {
          jwId: upstreamIds[termIndex],
          code: `history-${termIndex}`,
          nameCn: day ?? "未知日期学期",
          startDate: day ? new Date(`${day}T00:00:00Z`) : null,
        },
      });
      // 21 equal sort values cross the page boundary and require the jwId tie-breaker.
      const count = termIndex === 0 ? 21 : 1;
      for (let index = 0; index < count; index++) {
        const jwId = fixture.base + 500 + termIndex * 100 + index;
        await db.section.create({
          data: {
            jwId,
            code: "HISTORY.01",
            courseId: course.id,
            semesterId: semester.id,
            retiredAt:
              termIndex === 2 ? new Date("2026-01-01T00:00:00Z") : null,
            teachers: { connect: { id: teacher.id } },
          },
        });
        expected.push(jwId);
      }
    }
    const coursePages = [];
    const teacherPages = [];
    for (const page of [1, 2]) {
      coursePages.push(
        ...((
          await request(() => getCoursePage(course.jwId, "zh-cn", page))
        )?.sections.map((row) => row.jwId) ?? []),
      );
      teacherPages.push(
        ...((
          await request(() => getTeacherPage(teacher.id, "zh-cn", page))
        )?.sections.map((row) => row.jwId) ?? []),
      );
    }
    expect(coursePages).toEqual(expected);
    expect(teacherPages).toEqual(expected);
    expect(
      (await request(() => findCourseDetailByJwId(course.jwId)))?.sections.map(
        (row) => row.jwId,
      ),
    ).toEqual(expected.slice(0, 20));
    expect(
      (await request(() => findTeacherDetailById(teacher.id)))?.sections.map(
        (row) => row.jwId,
      ),
    ).toEqual(expected.slice(0, 20));
    for (const scope of [
      { kind: "course", jwId: course.jwId },
      { kind: "teacher", id: teacher.id },
    ] as const) {
      const all: number[] = [];
      for (const page of [1, 2, 3]) {
        const result = await request(() =>
          listSectionHistory({
            scope,
            locale: "zh-cn",
            pagination: { page, pageSize: 10 },
          }),
        );
        expect(result?.pagination.total).toBe(expected.length);
        if (!result) throw new Error("History scope missing");
        all.push(...result.data.map((row) => row.jwId));
      }
      expect(all).toEqual(expected);
    }
    expect(await db.section.count({ where: { courseId: course.id } })).toBe(
      expected.length,
    );
  });
});
