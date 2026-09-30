import { expect } from "vitest";
import { getCoursePage } from "@/features/catalog/server/course-page-data";
import { findCourseDetailByJwId } from "@/features/catalog/server/course-section-read-queries";
import { catalogReadTest as it } from "../shared/catalog-read-fixture";

// The cache transition owns its Vitest process as well as its database.
it("course.public-detail-cache", async ({
  catalogRead: { run, db, fixture, request, commitRevision },
}) => {
  await run(async () => {
    const [a, b] = fixture.courses;
    expect(
      (await request(() => findCourseDetailByJwId(a.jwId, "zh-cn")))?.namePrimary,
    ).toBe(a.nameCn);
    expect(
      (await request(() => findCourseDetailByJwId(b.jwId, "en-us")))?.namePrimary,
    ).toBe(b.nameEn);
    expect(
      (await request(() => findCourseDetailByJwId(a.jwId, "en-us")))?.namePrimary,
    ).toBe(a.nameEn);
    const page = await request(() => getCoursePage(a.jwId, "zh-cn"));
    expect(page?.id).toBe(a.id);
    expect(page?.sections).toHaveLength(1);
    expect(page).not.toHaveProperty("classifyId");
    const api = await request(() => findCourseDetailByJwId(a.jwId, "zh-cn"));
    expect(api).toHaveProperty("sections");
    expect(api).toHaveProperty("classifyId");
    expect(api).not.toHaveProperty("course");
    await db.course.update({
      where: { id: a.id },
      data: { nameCn: "已导入的新课程" },
    });
    expect(
      (await request(() => findCourseDetailByJwId(a.jwId)))?.namePrimary,
    ).toBe(a.nameCn);
    const missing = fixture.base + 99;
    expect(await request(() => findCourseDetailByJwId(missing))).toBeNull();
    await db.course.create({
      data: { jwId: missing, code: `${fixture.marker}-new`, nameCn: "新课程" },
    });
    await commitRevision();
    expect(
      (await request(() => findCourseDetailByJwId(a.jwId)))?.namePrimary,
    ).toBe("已导入的新课程");
    expect((await request(() => getCoursePage(a.jwId)))?.namePrimary).toBe(
      "已导入的新课程",
    );
    expect(
      (await request(() => findCourseDetailByJwId(missing)))?.namePrimary,
    ).toBe("新课程");
  });
});
