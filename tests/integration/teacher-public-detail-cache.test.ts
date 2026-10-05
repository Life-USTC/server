import { expect } from "vitest";
import { getTeacherPage } from "@/features/catalog/server/teacher-page-data";
import { findTeacherDetailById } from "@/features/catalog/server/teacher-summary-read-model";
import { catalogReadTest as it } from "../shared/catalog-read-fixture";

// The cache transition owns its Vitest process as well as its database.
it("teacher.public-detail-cache", { tags: ["@Teacher/Service"] }, async ({
  catalogRead: { run, db, fixture, request, commitRevision },
}) => {
  await run(async () => {
    const [a, b] = fixture.teachers;
    expect(
      (await request(() => findTeacherDetailById(a.id, "zh-cn")))?.department
        ?.id,
    ).toBe(a.departmentId);
    expect(
      (await request(() => findTeacherDetailById(b.id, "en-us")))?.department
        ?.id,
    ).toBe(b.departmentId);
    expect(
      (await request(() => findTeacherDetailById(a.id, "en-us")))?.namePrimary,
    ).toBe(a.nameEn);
    expect((await request(() => getTeacherPage(a.id)))?.id).toBe(a.id);
    expect(await request(() => getTeacherPage(a.id))).not.toHaveProperty(
      "jwId",
    );
    expect(await request(() => findTeacherDetailById(a.id))).toHaveProperty(
      "jwId",
      a.jwId,
    );
    expect(await request(() => findTeacherDetailById(a.id))).not.toHaveProperty(
      "teacher",
    );
    await db.teacher.update({
      where: { id: a.id },
      data: { nameCn: "导入更新的教师" },
    });
    expect(
      (await request(() => findTeacherDetailById(a.id)))?.namePrimary,
    ).toBe(a.nameCn);
    const missing = fixture.base + 99;
    expect(await request(() => findTeacherDetailById(missing))).toBeNull();
    await db.teacher.create({
      data: { id: missing, jwId: missing, nameCn: "新增教师" },
    });
    await commitRevision();
    expect(
      (await request(() => findTeacherDetailById(a.id)))?.namePrimary,
    ).toBe("导入更新的教师");
    expect((await request(() => getTeacherPage(a.id)))?.namePrimary).toBe(
      "导入更新的教师",
    );
    expect(
      (await request(() => findTeacherDetailById(missing)))?.namePrimary,
    ).toBe("新增教师");
  });
});
