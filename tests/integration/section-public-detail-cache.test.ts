import { expect } from "vitest";
import { findSectionDetailByJwId } from "@/features/catalog/server/course-section-read-queries";
import { getSectionPage } from "@/features/section-detail/server/section-page-data";
import { catalogReadTest as it } from "../shared/catalog-read-fixture";

// The cache transition owns its Vitest process as well as its database.
it("section.public-detail-cache", { tags: ["@Section/Service"] }, async ({
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
    const editor = await db.user.create({
      data: {
        name: "Description editor",
        username: "description-editor",
        email: "editor@example.test",
      },
    });
    const editedAt = new Date("2026-10-13T01:23:45.678Z");
    const description = await db.description.create({
      data: {
        sectionId: a.id,
        content: "**Fresh** description",
        lastEditedAt: editedAt,
        updatedAt: editedAt,
        lastEditedById: editor.id,
      },
    });
    await db.section.update({
      where: { id: a.id },
      data: { retiredAt: editedAt },
    });
    const edited = await request(() => getSectionPage(a.jwId));
    expect(edited?.description).toEqual({
      id: description.id,
      content: "**Fresh** description",
      renderedHtml: "<p><strong>Fresh</strong> description</p>",
      lastEditedAt: "2026-10-13T09:23:45.678+08:00",
      updatedAt: "2026-10-13T09:23:45.678+08:00",
      lastEditedBy: {
        id: editor.id,
        name: editor.name,
        username: editor.username,
        image: null,
      },
    });
    expect(edited?.section.retiredAt).toBe(editedAt.toISOString());
    await db.description.update({
      where: { id: description.id },
      data: { content: "Edited again", lastEditedById: null },
    });
    const editedAgain = await request(() => getSectionPage(a.jwId));
    expect(editedAgain?.description.content).toBe("Edited again");
    expect(editedAgain?.description.lastEditedBy).toBeNull();
    await db.description.delete({ where: { id: description.id } });
    expect(
      (await request(() => getSectionPage(a.jwId)))?.description.id,
    ).toBeNull();
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
