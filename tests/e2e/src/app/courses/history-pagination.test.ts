import { expect, test } from "@playwright/test";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

// Isolated rows, never shared seed courses or teachers. Equal sort values force
// the unique jwId tie-breaker to keep all 23 offerings reachable without repeats.
test("课程和教师历史分页包含第 21 条以后的已退役教学班", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await withE2ePrisma(async (prisma) => {
    const course = await prisma.course.create({
      data: {
        jwId: 1900100001,
        code: "E2E-HISTORY",
        nameCn: "历史分页测试课程",
        nameEn: "Historical offerings",
      },
    });
    const teacher = await prisma.teacher.create({
      data: {
        jwId: 1900100001,
        nameCn: "历史分页测试教师",
        nameEn: "History teacher",
      },
    });
    for (let index = 0; index < 23; index++) {
      await prisma.section.create({
        data: {
          jwId: 1900200000 + index,
          code: "E2E-HISTORY.01",
          courseId: course.id,
          retiredAt: index >= 20 ? new Date("2025-01-01T00:00:00Z") : null,
          teachers: { connect: { id: teacher.id } },
        },
      });
    }
    return { course, teacher };
  });

  try {
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      for (const route of [
        `/catalog/courses/${fixture.course.jwId}`,
        `/catalog/teachers/${fixture.teacher.id}`,
      ]) {
        const response = await gotoAndWaitForReady(page, route);
        const history = page.getByTestId("section-history-pagination");
        await expect(history).toContainText(/共 23 条|total: 23/);
        const rows = page.locator(
          '#sections a[href^="/catalog/sections/"]:visible',
        );
        const firstPageIds = new Set(
          await rows.evaluateAll((links) =>
            links.map((link) => link.getAttribute("href")),
          ),
        );
        expect(firstPageIds.size).toBe(20);
        await history
          .getByRole("link", { name: /下一页|Next/i, exact: true })
          .click();
        await expect(page).toHaveURL(
          new RegExp(`${route}\\?sectionsPage=2#sections$`),
        );
        await expect(history).toContainText(/21–23/);
        const secondPageIds = new Set(
          await rows.evaluateAll((links) =>
            links.map((link) => link.getAttribute("href")),
          ),
        );
        expect(secondPageIds.size).toBe(3);
        expect(new Set([...firstPageIds, ...secondPageIds]).size).toBe(23);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
          "href",
          new RegExp(`${route}$`),
        );
        // A direct reload must retain page 2 even after root HTML warmed its cache.
        const pagedResponse = await page.reload();
        expect(pagedResponse?.headers()["cache-control"]).toContain("no-store");
        await expect(history).toContainText(/21–23/);
        await expect(
          page
            .locator('#sections a[href="/catalog/sections/1900200022"]:visible')
            .first(),
        ).toBeVisible();
        await history
          .getByRole("link", { name: /上一页|Previous/i, exact: true })
          .click();
        await expect(page).toHaveURL(new RegExp(`${route}#sections$`));
        await expect(history).toContainText(/1–20/);
        expect(response?.status()).toBe(200);
      }
    }
    await gotoAndWaitForReady(
      page,
      `/catalog/teachers/${fixture.teacher.id}?sectionsPage=2#sections`,
    );
    await page
      .locator('#sections a[href="/catalog/sections/1900200022"]:visible')
      .first()
      .click();
    await expect(page).toHaveURL(/\/catalog\/sections\/1900200022$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  } finally {
    await withE2ePrisma(async (prisma) => {
      await prisma.section.deleteMany({
        where: { courseId: fixture.course.id },
      });
      await prisma.teacher.delete({ where: { id: fixture.teacher.id } });
      await prisma.course.delete({ where: { id: fixture.course.id } });
    });
  }
});
