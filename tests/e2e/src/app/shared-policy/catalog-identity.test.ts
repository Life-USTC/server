import { expect, test } from "@playwright/test";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

async function createFixture() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const base = 1_700_000_000 + Math.floor(Math.random() * 100_000_000);
  return withE2ePrisma((db) =>
    db.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          id: base,
          jwId: base + 1,
          code: `IDENTITY-${suffix}`,
          nameCn: "身份显示测试课程",
          nameEn: "Identity display course",
        },
      });
      const teacher = await tx.teacher.create({
        data: {
          id: base + 2,
          jwId: base + 3,
          code: `TEACHER-${suffix}`,
          nameCn: "身份显示测试教师",
          nameEn: "Identity display teacher",
        },
      });
      const section = await tx.section.create({
        data: {
          id: base + 4,
          jwId: base + 5,
          code: `${course.code}.01`,
          courseId: course.id,
          teachers: { connect: { id: teacher.id } },
        },
      });
      const user = await tx.user.create({
        data: {
          name: "Identity display user",
          username: `identity${suffix}`,
          email: `identity-${suffix}@example.test`,
        },
      });
      return { course, teacher, section, user };
    }),
  );
}

async function cleanup(fixture: Awaited<ReturnType<typeof createFixture>>) {
  await withE2ePrisma(async (db) => {
    await db.section.delete({ where: { id: fixture.section.id } });
    await db.teacher.delete({ where: { id: fixture.teacher.id } });
    await db.course.delete({ where: { id: fixture.course.id } });
    await db.user.delete({ where: { id: fixture.user.id } });
  });
}

test("permission-ui.identity-4", async ({ page }) => {
  const fixture = await createFixture();
  const { course, teacher, section, user } = fixture;
  try {
    const forbidden = [
      course.id,
      course.jwId,
      teacher.id,
      teacher.jwId,
      section.id,
      section.jwId,
      user.id,
    ].map(String);
    for (const locale of ["zh-cn", "en-us"]) {
      expect(
        (
          await page.request.post("/api/account/preferences", {
            data: { locale },
          })
        ).status(),
      ).toBe(200);
      for (const [path, name, code] of [
        [
          `/catalog/courses/${course.jwId}`,
          locale === "zh-cn" ? course.nameCn : course.nameEn,
          course.code,
        ],
        [
          `/catalog/sections/${section.jwId}`,
          locale === "zh-cn" ? course.nameCn : course.nameEn,
          section.code,
        ],
        [
          `/catalog/teachers/${teacher.id}`,
          locale === "zh-cn" ? teacher.nameCn : teacher.nameEn,
          section.code,
        ],
      ]) {
        if (!path || !name || !code)
          throw new Error("Incomplete identity fixture");
        await gotoAndWaitForReady(page, path);
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
          name,
        );
        await expect(page.locator("#main-content")).toContainText(code);
        const visible = await page.locator("#main-content").innerText();
        for (const id of forbidden) expect(visible).not.toContain(id);
        for (const id of forbidden)
          expect(await page.title()).not.toContain(id);
      }
    }
    await page.context().addCookies([await createSignedSessionCookie(user.id)]);
    for (const path of [
      "/account/settings",
      `/community/users/${user.username}`,
    ]) {
      await gotoAndWaitForReady(page, path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.locator("#main-content").innerText()).not.toContain(
        user.id,
      );
      expect(await page.title()).not.toContain(user.id);
    }
    const courseResponse = await page.request.get(
      `/api/catalog/courses/${course.jwId}`,
    );
    expect(courseResponse.status()).toBe(200);
    expect(await courseResponse.json()).toMatchObject({
      jwId: course.jwId,
      code: course.code,
    });
    const sectionResponse = await page.request.get(
      `/api/catalog/sections/${section.jwId}`,
    );
    expect(sectionResponse.status()).toBe(200);
    expect(await sectionResponse.json()).toMatchObject({
      jwId: section.jwId,
      code: section.code,
    });
  } finally {
    await cleanup(fixture);
  }
});

test("cases.missing-data.section-missing-teacher-location-or-exam-1", async ({
  page,
}) => {
  const fixture = await createFixture();
  try {
    await withE2ePrisma((db) =>
      db.section.update({
        where: { id: fixture.section.id },
        data: { teachers: { set: [] } },
      }),
    );
    for (const locale of ["zh-cn", "en-us"]) {
      expect(
        (
          await page.request.post("/api/account/preferences", {
            data: { locale },
          })
        ).status(),
      ).toBe(200);
      await gotoAndWaitForReady(
        page,
        `/catalog/sections/${fixture.section.jwId}`,
      );
      const name =
        locale === "zh-cn" ? fixture.course.nameCn : fixture.course.nameEn;
      if (!name) throw new Error("Missing localized fixture name");
      await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
      await expect(page.locator("#teachers")).toContainText(
        locale === "zh-cn" ? "暂无教师。" : "No teachers listed.",
      );
      const campus = page
        .locator("#overview dt")
        .filter({ hasText: locale === "zh-cn" ? "校区" : "Campus" });
      await expect(campus.locator("+ dd")).toHaveText(
        locale === "zh-cn" ? "暂无" : "N/A",
      );
      for (const region of ["#calendar", "#exams"]) {
        await expect(page.locator(region)).toContainText(
          locale === "zh-cn"
            ? "此班级暂无课程或考试安排"
            : "No schedule or exam events available for this section",
        );
      }
      expect(await page.locator("#main-content").innerText()).not.toMatch(
        /取消|cancelled|canceled/i,
      );
      const response = await page.request.get(
        `/api/catalog/sections/${fixture.section.jwId}`,
      );
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({
        jwId: fixture.section.jwId,
        teachers: [],
        exams: [],
        schedules: [],
      });
    }
  } finally {
    await cleanup(fixture);
  }
});
