/**
 * E2E tests for /catalog/young-events/[youngId] — 第二课堂活动详情
 *
 * ## Data Represented
 * - One signup event: name, category, status, event time, signup window,
 *   location, organizer, department, hours, capacity
 * - Seed event: DEV_SEED.youngEvent (youngId dev-scenario-young-event)
 *
 * ## UI/UX Elements
 * - Field grid with event metadata
 * - External signup link to young.ustc.edu.cn
 * - Back link to the event list
 *
 * ## Edge Cases
 * - Unknown youngId renders the 404 error page
 */
import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { visibleText } from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { assertPageContract } from "../../_shared/page-contract";

const DETAIL_PATH = `/catalog/young-events/${DEV_SEED.youngEvent.youngId}`;

test.describe("/catalog/young-events/[youngId] 第二课堂活动详情", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/catalog/young-events/[youngId]",
      testInfo,
    });
  });

  test("渲染活动字段与返回链接", async ({ page }) => {
    await gotoAndWaitForReady(page, DETAIL_PATH);

    await expect(
      page.getByRole("heading", { level: 1, name: DEV_SEED.youngEvent.name }),
    ).toBeVisible();
    await expect(visibleText(page, DEV_SEED.youngEvent.location)).toBeVisible();
    await expect(
      visibleText(page, DEV_SEED.youngEvent.organizer),
    ).toBeVisible();

    const signupLink = page.getByRole("link", {
      name: /young\.ustc\.edu\.cn/i,
    });
    await expect(signupLink).toBeVisible();
    await expect(signupLink).toHaveAttribute(
      "href",
      "https://young.ustc.edu.cn",
    );

    const backLink = page.getByRole("link", {
      name: /返回活动列表|Back to all events/i,
    });
    await expect(backLink).toBeVisible();
    await backLink.click();
    await page.waitForURL(/\/catalog\/young-events$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /第二课堂|Second Classroom/i,
      }),
    ).toBeVisible();
  });

  test("未知 youngId 显示 404", async ({ page }) => {
    const response = await page.goto(
      "/catalog/young-events/e2e-unknown-young-id",
    );
    expect(response?.status()).toBe(404);
  });
});

for (const width of [1280, 390]) {
  test(`参与信息保留未知值且在 ${width}px 可阅读`, async ({ page }) => {
    const { createFixturePrisma, disconnectTestPrisma } = await import(
      "../../../../../shared/prisma"
    );
    const db = createFixturePrisma();
    const youngId = `metadata-${crypto.randomUUID()}`;
    await db.youngEvent.create({
      data: {
        youngId,
        name: "线上学术交流 · 参与信息测试",
        isActive: true,
        rawJson: {},
        requiresSignup: true,
        requiresSignupInfo: true,
        allowedAttachmentTypes: ["pdf", "docx"],
        isOnline: true,
        onlineMeetingInfo: "800-414-186",
        externalSponsor: "校外合作机构",
        signupScopeCode: "2",
        signupDepartmentIds: ["opaque-department-id"],
        capacity: 20,
        appliedCount: null,
        applyEndAt: new Date("2035-09-24T09:00:00+08:00"),
      },
    });
    try {
      await page.setViewportSize({ width, height: 844 });
      await gotoAndWaitForReady(page, `/catalog/young-events/${youngId}`);
      await expect(
        page.getByText("800-414-186", { exact: true }),
      ).toBeVisible();
      await expect(page.getByText("PDF, DOCX", { exact: true })).toBeVisible();
      await expect(
        page.getByText("校外合作机构", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(
          /报名时需填写补充信息|Additional information required at registration/,
        ),
      ).toBeVisible();
      await expect(
        page.getByText("opaque-department-id", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.locator("dt").filter({ hasText: /^(已报名|Registered)$/ }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: /记录信息|Record information/ }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await gotoAndWaitForReady(
        page,
        `/catalog/young-events?search=${encodeURIComponent("线上学术交流 · 参与信息测试")}`,
      );
      if (width >= 1280)
        await expect(
          page.getByRole("cell", { name: /未提供 \/ 20|Not provided \/ 20/ }),
        ).toBeVisible();
    } finally {
      await db.youngEvent.delete({ where: { youngId } });
      await disconnectTestPrisma(db);
    }
  });
}
