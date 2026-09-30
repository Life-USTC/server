import { expect } from "vitest";
import { findSectionDetailByJwId } from "@/features/catalog/server/course-section-read-queries";
import { getSectionPage } from "@/features/section-detail/server/section-page-data";
import { catalogReadTest as it } from "../shared/catalog-read-fixture";

// The cache transition owns its Vitest process as well as its database.
it("section.public-detail-cache", async ({
  catalogRead: { run, db, fixture, request, commitRevision },
}) => {
  await run(async () => {
    const [a, b] = fixture.sections;
    const [courseA, courseB] = fixture.courses;
    const group = await db.scheduleGroup.create({
      data: {
        jwId: fixture.base,
        sectionId: a.id,
        no: 1,
        limitCount: 20,
        stdCount: 10,
        actualPeriods: 1,
        isDefault: true,
      },
    });
    await db.schedule.create({
      data: {
        sectionId: a.id,
        scheduleGroupId: group.id,
        startUnit: 1,
        endUnit: 2,
        date: new Date("2026-09-28"),
        weekday: 1,
        periods: 1,
        weekIndex: 1,
        startTime: 800,
        endTime: 900,
      },
    });
    await db.teacherAssignment.create({
      data: {
        sectionId: a.id,
        teacherId: fixture.teachers[0].id,
        role: "lecturer",
        period: 1,
      },
    });
    const shape = {
      includeExams: false,
      includeSchedules: false,
      includeTeacherDepartments: false,
    };
    const lean = await request(() =>
      findSectionDetailByJwId(a.jwId, "zh-cn", shape),
    );
    expect(lean?.schedules).toEqual([]);
    expect(lean?.teacherAssignments).toEqual([]);
    const full = await request(() => findSectionDetailByJwId(a.jwId, "en-us"));
    expect(full?.course.namePrimary).toBe(courseA.nameEn);
    expect(full?.schedules).toHaveLength(1);
    expect(full?.teacherAssignments).toHaveLength(1);
    expect(
      (await request(() => findSectionDetailByJwId(a.jwId, "zh-cn")))
        ?.schedules,
    ).toHaveLength(1);
    expect(full?.teachers[0].department?.id).toBe(fixture.departments[0].id);
    expect(
      (await request(() => findSectionDetailByJwId(b.jwId)))?.course
        .namePrimary,
    ).toBe(courseB.nameCn);
    expect(
      (await request(() => findSectionDetailByJwId(a.jwId, "zh-cn", shape)))
        ?.schedules,
    ).toEqual([]);
    expect((await request(() => getSectionPage(a.jwId)))?.section.id).toBe(
      a.id,
    );
    await db.section.update({
      where: { id: a.id },
      data: { code: "UPDATED-SECTION" },
    });
    expect(
      (await request(() => findSectionDetailByJwId(a.jwId, "zh-cn", shape)))
        ?.code,
    ).toBe(a.code);
    const missing = fixture.base + 99;
    expect(await request(() => findSectionDetailByJwId(missing))).toBeNull();
    await db.section.create({
      data: {
        jwId: missing,
        code: "NEW-SECTION",
        courseId: courseA.id,
        semesterId: fixture.semester.id,
      },
    });
    await commitRevision();
    expect(
      (await request(() => findSectionDetailByJwId(a.jwId, "zh-cn", shape)))
        ?.code,
    ).toBe("UPDATED-SECTION");
    expect((await request(() => getSectionPage(a.jwId)))?.section.code).toBe(
      "UPDATED-SECTION",
    );
    expect((await request(() => findSectionDetailByJwId(missing)))?.code).toBe(
      "NEW-SECTION",
    );
  });
});
