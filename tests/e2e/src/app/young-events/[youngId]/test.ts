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
import { expect } from "@playwright/test";
import type { YoungEvent } from "../../../../../../src/generated/prisma-node/client";
import {
  expectPrivateViewerState,
  preparePrivateViewer,
} from "../../../../utils/authenticated-read-fixture";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { visibleText } from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { test as privateTest } from "../../../../utils/personal-preferences-fixture";
import { test } from "../../../../utils/young-public-fixture";
import { assertPageContract } from "../../_shared/page-contract";

const DETAIL_PATH = `/catalog/young-events/${DEV_SEED.youngEvent.youngId}`;

test.describe("/catalog/young-events/[youngId] 第二课堂活动详情", () => {
  test("页面契约", async ({
    page,
    preferenceFlow,
    youngPublicState: _youngPublicState,
  }, testInfo) => {
    await preferenceFlow.run(async () => {
      await assertPageContract(page, {
        routePath: "/catalog/young-events/[youngId]",
        testInfo,
      });
    });
  });

  test("young-event.public-no-signin", async ({
    page,
    preferenceFlow,
    youngPublicState: _youngPublicState,
  }) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(page, DETAIL_PATH);

      const banner = page.getByTestId("young-event-banner");
      await expect(
        banner.getByRole("heading", {
          level: 1,
          name: DEV_SEED.youngEvent.name,
        }),
      ).toBeVisible();
      await expect(
        banner.getByText(DEV_SEED.youngEvent.activityLevel),
      ).toBeVisible();
      await expect(page.getByTestId("young-event-overview")).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: /更多活动资料|More activity details/,
        }),
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

      await expect(
        page.getByRole("link", { name: /返回活动列表|Back to all events/i }),
      ).toHaveCount(0);
      await expect(
        banner.getByRole("button", { name: /^(订阅活动|Subscribe to event)$/ }),
      ).toBeVisible();
      await youngNav
        .getByRole("link", { name: /^(?:活动列表|Activity list)$/ })
        .click();
      await page.waitForURL(/\/catalog\/young-events$/);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /第二课堂|Second Classroom/i,
        }),
      ).toBeVisible();
    });
  });

  test("未知 youngId 显示 404", async ({ page, preferenceFlow }) => {
    await preferenceFlow.run(async () => {
      const response = await page.goto(
        "/catalog/young-events/e2e-unknown-young-id",
      );
      expect(response?.status()).toBe(404);
    });
  });
});

for (const width of [1280, 390]) {
  privateTest(
    `参与信息保留未知值且在 ${width}px 可阅读`,
    async ({ page, isolatedWorker, preferenceFlow, run }) => {
      await run(async () => {
        const db = isolatedWorker.database.owner;
        const events: YoungEvent[] = [];
        await preferenceFlow.run(async () => {
          const youngId = `metadata-${crypto.randomUUID()}`;
          const online = await db.youngEvent.create({
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
          events.push(online);
          await page.setViewportSize({ width, height: 844 });
          await gotoAndWaitForReady(page, `/catalog/young-events/${youngId}`);
          await expect(
            page.getByText("800-414-186", { exact: true }),
          ).toHaveCount(0);
          await expect(
            page.getByText("PDF, DOCX", { exact: true }),
          ).toHaveCount(0);
          await expect(
            page.getByText("校外合作机构", { exact: true }),
          ).toHaveCount(0);
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
          const offline = await db.youngEvent.create({
            data: {
              youngId: `${youngId}-offline`,
              name: "Offline fixture",
              isActive: true,
              rawJson: {},
              isOnline: false,
            },
          });
          events.push(offline);
          await gotoAndWaitForReady(
            page,
            `/catalog/young-events/${youngId}-offline`,
          );
          await expect(
            page.getByText(
              /^(线下活动|In-person event|提供线上会议|Online meeting available)$/,
            ),
          ).toHaveCount(0);
        });
        expect(
          await db.youngEvent.findMany({ orderBy: { id: "asc" } }),
        ).toEqual(events);
        expect(await db.youngOrganizer.findMany()).toEqual([]);
        expect(await db.user.findMany()).toEqual([]);
        expect(await db.session.findMany()).toEqual([]);
        expect(await db.userYoungEventSubscription.findMany()).toEqual([]);
        expect(await db.userYoungOrganizerSubscription.findMany()).toEqual([]);
        expect(await db.youngNotification.findMany()).toEqual([]);
        expect(await db.auditLog.findMany()).toEqual([]);
      });
    },
  );
}

for (const status of [200, 401]) {
  privateTest(
    `subscription resolves independently of unavailable shell navigation (${status})`,
    async ({ page, isolatedWorker, preferenceFlow, run }) => {
      await run(async () => {
        const viewer = await preferenceFlow.prepare(() =>
          preparePrivateViewer(page, isolatedWorker, false),
        );
        const db = isolatedWorker.database.owner;
        const event = await preferenceFlow.prepare(() =>
          db.youngEvent.create({
            data: {
              youngId: DEV_SEED.youngEvent.youngId,
              name: DEV_SEED.youngEvent.name,
              isActive: true,
              requiresSignup: true,
              rawJson: {},
            },
          }),
        );
        await preferenceFlow.run(async () => {
          await gotoAndWaitForReady(page, "/workspace/overview");
          const session = await (
            await preferenceFlow.http(() =>
              page.request.get("/api/auth/get-session"),
            )
          ).json();
          let bootstrapRequests = 0;
          await preferenceFlow.route(
            page,
            "**/_internal/shell-bootstrap",
            async (route) => {
              bootstrapRequests++;
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                  viewer: session.user,
                  navigation: null,
                }),
              });
            },
          );
          await preferenceFlow.route(
            page,
            `**/api/workspace/young-event-subscriptions/${DEV_SEED.youngEvent.youngId}`,
            async (route) => {
              await route.fulfill({
                status,
                contentType: "application/json",
                body: JSON.stringify(
                  status === 200
                    ? {
                        youngId: DEV_SEED.youngEvent.youngId,
                        subscribed: false,
                        remindSignup: true,
                        remindDeadline: true,
                        remindStart: true,
                      }
                    : { error: "Unauthorized" },
                ),
              });
            },
          );
          await gotoAndWaitForReady(page, DETAIL_PATH);
          await expect(
            page.getByTestId("young-event-banner").getByRole("button", {
              name: /^(订阅活动|Subscribe to event)$/,
            }),
          ).toBeEnabled();
          await expect.poll(() => bootstrapRequests).toBe(1);
        });
        await expectPrivateViewerState(db, viewer, [event]);
      });
    },
  );
}

test("未登录时标题右侧显示订阅活动，且不请求私人订阅数据", async ({
  page,
  preferenceFlow,
  youngPublicState: _youngPublicState,
}) => {
  await preferenceFlow.run(async () => {
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
      page.getByTestId("young-event-banner").getByRole("button", {
        name: /^(订阅活动|Subscribe to event)$/,
      }),
    ).toBeVisible();
    expect(privateRequests).toBe(0);
  });
});
