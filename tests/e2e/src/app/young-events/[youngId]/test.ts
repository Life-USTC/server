/**
 * E2E tests for /catalog/young-events/[youngId] — 第二课堂活动详情
 *
 * ## Data Represented
 * - One signup event: name and status badges on the poster banner
 * - Seed event: DEV_SEED.youngEvent (youngId dev-scenario-young-event)
 *
 * ## UI/UX Elements
 * - Full-width poster banner with the title and badges
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

    const banner = page.getByTestId("young-event-banner");
    await expect(
      banner.getByRole("heading", { level: 1, name: DEV_SEED.youngEvent.name }),
    ).toBeVisible();
    await expect(
      banner.getByText(DEV_SEED.youngEvent.activityLevel),
    ).toBeVisible();
    await expect(page.getByTestId("young-event-overview")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /更多活动资料|More activity details/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /前往官方平台|official site/i }),
    ).toHaveCount(0);

    const youngNav = page.getByTestId("young-sidebar");
    await expect(youngNav).toBeVisible();
    await expect(
      youngNav.getByRole("link", { name: /^(?:活动列表|Activity list)$/ }),
    ).not.toHaveAttribute("aria-current", "page");
    await expect(
      youngNav.getByRole("link", { name: DEV_SEED.youngEvent.name }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("navigation", { name: /面包屑|Breadcrumb/ }),
    ).toHaveCount(0);

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
        location: "东区学生活动中心",
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
      await expect(page.getByText("800-414-186", { exact: true })).toHaveCount(
        0,
      );
      await expect(page.getByText("PDF, DOCX", { exact: true })).toHaveCount(0);
      await expect(page.getByText("校外合作机构", { exact: true })).toHaveCount(
        0,
      );
      await expect(
        page.getByText(
          /报名时需填写补充信息|Additional information required at registration/,
        ),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", {
          name: /^(?:时间与报名|报名与参与|组织与联系|场地安排|活动概览|Time and registration|Registration and participation|Organization and contact|Venues|Activity at a glance)$/,
        }),
      ).toHaveCount(0);
      await expect(
        page
          .getByTestId("young-event-banner")
          .getByText(/提供线上会议|Online meeting available/, {
            exact: true,
          }),
      ).toBeVisible();
      await expect(page.getByTestId("young-event-overview")).toHaveCount(0);
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
      await expect(visibleText(page, /东区学生活动中心/)).toBeVisible();
      // Imported public facts are cached by snapshot revision. Use a second
      // fixture for the false state rather than mutating an already-read row.
      await db.youngEvent.create({
        data: {
          youngId: `${youngId}-offline`,
          name: "Offline fixture",
          isActive: true,
          rawJson: {},
          isOnline: false,
        },
      });
      await gotoAndWaitForReady(
        page,
        `/catalog/young-events/${youngId}-offline`,
      );
      await expect(
        page.getByText(
          /^(线下活动|In-person event|提供线上会议|Online meeting available)$/,
        ),
      ).toHaveCount(0);
    } finally {
      await db.youngEvent.deleteMany({
        where: { youngId: { in: [youngId, `${youngId}-offline`] } },
      });
      await disconnectTestPrisma(db);
    }
  });
}

test("详情页不渲染订阅控件，也不请求私人订阅数据", async ({ page }) => {
  let privateRequests = 0;
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.startsWith(
        "/api/workspace/young-event-subscriptions/",
      )
    )
      privateRequests++;
  });
  await gotoAndWaitForReady(page, DETAIL_PATH, { browserHealth: {} });
  await expect(
    page.getByRole("button", {
      name: /^(登录后订阅|订阅活动|Sign in to subscribe|Subscribe to event)$/,
    }),
  ).toHaveCount(0);
  expect(privateRequests).toBe(0);
});
