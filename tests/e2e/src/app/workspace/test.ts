/**
 * E2E tests for the Workspace Home Page (`/`)
 *
 * ## Data Represented
 * - **Public (unauthenticated):** A lightweight catalog entry at `/`, with bus
 *   and links exposed as independent public routes.
 * - **Authenticated:** Task destinations are direct links in the "Workspace"
 *   group. Catalog and campus destinations use the same "Catalog" / "Campus"
 *   groups as the guest sidebar.
 *
 * ## UI/UX Elements
 * - Sidebar navigation with collapsible groups
 * - User menu visible when authenticated; sign-in CTA when not
 *
 * ## Edge Cases
 * - Recognized legacy `?tab=` values permanently redirect to semantic routes.
 * - Invalid `?tab=` values do not select another public resource.
 */
import { expect } from "@playwright/test";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import { DEV_SEED } from "../../../utils/dev-seed";
import { test } from "../../../utils/homework-fixture";
import {
  appSidebar,
  expandWorkspaceSidebarGroup,
  sidebarNavigationLink,
} from "../../../utils/locators";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test as publicTest } from "../../../utils/public-worker";
import { captureStepScreenshot } from "../../../utils/screenshot";

test.describe("仪表盘", () => {
  test.describe.configure({ mode: "parallel" });
  publicTest(
    "未登录旧 homework tab 永久重定向到受保护语义路径",
    async ({ publicFlow, page }) => {
      await publicFlow.run(async () => {
        const response = await page.request.get(
          "/?tab=homeworks&homeworkView=list",
          {
            maxRedirects: 0,
          },
        );

        expect(response.status()).toBe(308);
        expect(response.headers().location).toBe(
          "/workspace/homeworks?homeworkView=list",
        );
      }, {});
    },
  );

  publicTest(
    "无效 tab 不再选择其他公共资源",
    async ({ publicFlow, page }, testInfo) => {
      await publicFlow.run(async () => {
        await gotoAndWaitForReady(page, "/?tab=unknown", {
          testInfo,
          screenshotLabel: "home-invalid-tab",
        });

        await expect(page).toHaveURL(/\/\?tab=unknown$/);
        await expect(
          page.getByRole("heading", {
            level: 1,
            name: /课程、课表与校园生活，一站搞定|Courses, schedules, and campus life/i,
          }),
        ).toBeVisible();
        await expect(page.getByTestId("bus-compact-summary")).toHaveCount(0);
      }, {});
    },
  );

  publicTest(
    "/workspace 默认永久重定向到 overview 语义路径",
    async ({ publicFlow, page }) => {
      await publicFlow.run(async () => {
        for (const method of ["GET", "HEAD"]) {
          const response = await page.request.fetch(
            "/workspace?overviewWeek=next",
            {
              maxRedirects: 0,
              method,
            },
          );

          expect(response.status()).toBe(308);
          expect(response.headers().location).toBe(
            "/workspace/overview?overviewWeek=next",
          );
        }
      }, {});
    },
  );

  test("登录后首页显示总览、所有标签和独立数据", async ({
    page,
    homeworkStates,
    homeworkRun,
  }, testInfo) => {
    await homeworkRun(
      async () => {
        await page.setViewportSize({ width: 1280, height: 720 });
        await gotoAndWaitForReady(page, "/", {
          testInfo,
          screenshotLabel: "workspace",
        });

        await expect(page).toHaveURL(/\/workspace\/overview(?:\?.*)?$/);
        await expect(
          page.getByRole("heading", {
            level: 1,
            name: /^(总览|Overview)$/,
          }),
        ).toHaveCount(1);
        await expect(
          page.getByRole("main", { name: /^(总览|Overview)$/ }),
        ).toHaveCount(1);
        await expect(page).toHaveTitle(/^(总览|Overview) - Life@USTC$/);
        await expect(page.locator("#app-user-menu")).toBeVisible();

        // Task-oriented workspace destinations are directly reachable.
        await expandWorkspaceSidebarGroup(page);
        for (const label of [
          /^(今天|Today)$/i,
          /^(日历|Calendar)$/i,
          /^(作业|Homework)$/i,
        ]) {
          await expect(sidebarNavigationLink(page, label)).toBeVisible();
        }

        const overdueTitle = page
          .getByText(homeworkStates[0].title, { exact: true })
          .first();
        await expect(overdueTitle).toBeVisible();
        const overdueTitleBox = await overdueTitle.boundingBox();
        expect(overdueTitleBox?.width ?? 0).toBeGreaterThan(80);
        expect(
          overdueTitleBox?.height ?? Number.POSITIVE_INFINITY,
        ).toBeLessThan(48);
        await expect(
          page.locator('a[href^="/api/catalog/links/resolve?slug="]'),
        ).toHaveCount(DEV_SEED.catalogLinks.overviewLimit);
        await expect(page.locator("vite-error-overlay")).toHaveCount(0);

        await captureStepScreenshot(page, testInfo, "workspace-home");
      },
      { calendarMessages: [], calendarTokenCreated: false },
    );
  });

  test("可通过侧边栏导航到作业标签", async ({
    page,
    account: _account,
    homeworkRun,
  }, testInfo) => {
    await homeworkRun(
      async () => {
        await gotoAndWaitForReady(page, "/");
        await expandWorkspaceSidebarGroup(page);

        const homeworksTab = sidebarNavigationLink(page, /^(作业|Homework)$/i);
        await expect(homeworksTab).toBeVisible();
        await homeworksTab.click();

        await expect(page).toHaveURL(/\/workspace\/homeworks(?:\?.*)?$/);
        await captureStepScreenshot(
          page,
          testInfo,
          "workspace-navigate-homeworks",
        );
      },
      { calendarMessages: [], calendarTokenCreated: false },
    );
  });

  test("navigation badges retain the bootstrap counts across catalog navigation", async ({
    page,
    account,
    academic,
    homeworkStates: _homeworkStates,
    homeworkRun,
  }, testInfo) => {
    await homeworkRun(
      async () => {
        await page.setViewportSize({ width: 1280, height: 720 });
        let bootstrapRequestCount = 0;
        page.on("request", (request) => {
          if (
            new URL(request.url()).pathname === "/_internal/shell-bootstrap"
          ) {
            bootstrapRequestCount += 1;
          }
        });
        await gotoAndWaitForReady(page, "/workspace/overview");
        expect(bootstrapRequestCount).toBe(0);

        const bootstrapResponsePromise = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/_internal/shell-bootstrap" &&
            response.request().method() === "GET",
        );
        await gotoAndWaitForReady(
          page,
          `/catalog/courses?search=${academic.course.code}`,
          { testInfo },
        );
        const bootstrapResponse = await bootstrapResponsePromise;
        expect(bootstrapRequestCount).toBe(1);
        expect(bootstrapResponse.status()).toBe(200);
        expect(bootstrapResponse.headers()["cache-control"]).toBe(
          "private, no-store",
        );

        const payload = (await bootstrapResponse.json()) as {
          navigation: {
            calendarItemsCount: number;
            examsCount: number;
            pendingHomeworksCount: number;
            pendingTodosCount: number;
            subscribedSectionCount: number;
          };
        };
        expect(payload.navigation).toEqual({
          userId: account.id,
          unreadActivityNotificationsCount: 0,
          calendarItemsCount: 0,
          examsCount: 0,
          pendingHomeworksCount: 1,
          pendingTodosCount: 0,
          subscribedSectionCount: 1,
        });
        await expandWorkspaceSidebarGroup(page);

        for (const [label, count] of [
          [/^(日历|Calendar)$/i, payload.navigation.calendarItemsCount],
          [/^(作业|Homework)$/i, payload.navigation.pendingHomeworksCount],
          [/^(待办|Todos?)$/i, payload.navigation.pendingTodosCount],
          [/^(考试|Exams?)$/i, payload.navigation.examsCount],
          [
            /^(教学班订阅|Section Subscriptions)$/i,
            payload.navigation.subscribedSectionCount,
          ],
        ] as const) {
          const menuItem = sidebarNavigationLink(page, label).locator(
            "xpath=ancestor::*[@data-slot='sidebar-menu-item'][1]",
          );
          const badge = menuItem.locator("[data-slot='sidebar-menu-badge']");
          if (count > 0) {
            await expect(badge).toHaveText(String(count));
          } else {
            await expect(badge).toHaveCount(0);
          }
        }
        expect(
          bootstrapResponse.headers()["cloudflare-cdn-cache-control"],
        ).toBe("no-store");
        await page
          .locator(
            `#main-content a[href="/catalog/courses/${academic.course.jwId}"]:visible`,
          )
          .first()
          .click();
        await expect(page).toHaveURL(
          new RegExp(`/catalog/courses/${academic.course.jwId}$`),
        );
        await expect(page.locator("#app-user-menu")).toContainText(
          account.name,
        );
        expect(bootstrapRequestCount).toBe(1);
      },
      { calendarMessages: [], calendarTokenCreated: false },
    );
  });

  test("仪表盘路径别名渲染匹配的标签", async ({
    page,
    academic: _academic,
    homeworkRun,
  }, testInfo) => {
    await homeworkRun(
      async () => {
        await gotoAndWaitForReady(page, "/catalog/links", {
          testInfo,
          screenshotLabel: "workspace-links-path",
        });
        const linksWorkspaceTab = sidebarNavigationLink(
          page,
          /^(网站|Websites)$/i,
        );
        await expect(linksWorkspaceTab).toBeVisible();
        await expect(linksWorkspaceTab).toHaveAttribute("aria-current", "page");
        await expect(
          page.getByRole("searchbox", {
            name: /搜索网站名称、描述或域名|Search by name, description, or domain/i,
          }),
        ).toBeVisible();

        await gotoAndWaitForReady(page, "/workspace/homeworks");
        const homeworksWorkspaceTab = sidebarNavigationLink(
          page,
          /^(作业|Homework)$/i,
        );
        await expect(homeworksWorkspaceTab).toBeVisible();
        await expect(homeworksWorkspaceTab).toHaveAttribute(
          "aria-current",
          "page",
        );

        await gotoAndWaitForReady(page, "/workspace/subscriptions");
        await expect(page).toHaveURL(/\/workspace\/subscriptions(?:\?.*)?$/);
        await expect(
          appSidebar(page).getByRole("link", {
            name: /^(教学班订阅|Section Subscriptions)$/i,
          }),
        ).toBeVisible();
        await expect(
          page
            .getByText(DEV_SEED.semesterNameCn)
            .or(
              page.getByText(
                formatSemesterName("en-us", DEV_SEED.semesterNameCn),
              ),
            )
            .first(),
        ).toBeVisible();
        await captureStepScreenshot(
          page,
          testInfo,
          "workspace-subscriptions-path",
        );
      },
      { calendarMessages: [], calendarTokenCreated: true },
    );
  });

  test("ui.workspace-mobile-priority-1", async ({
    page,
    homeworkStates: _homeworkStates,
    homeworkRun,
  }, testInfo) => {
    await homeworkRun(
      async () => {
        await page.setViewportSize({ height: 844, width: 390 });
        await gotoAndWaitForReady(page, "/", {
          testInfo,
          screenshotLabel: "workspace-mobile-priority",
        });

        const focus = page.getByTestId("workspace-overview-focus");
        const links = page.getByTestId("workspace-overview-links");
        await expect(focus).toBeVisible();
        await expect(focus.getByText(/此刻与下一步|Now & next/i)).toBeVisible();
        await expect(links).toBeVisible();

        const focusBox = await focus.boundingBox();
        const linksBox = await links.boundingBox();
        expect(focusBox?.y).toBeLessThan(linksBox?.y ?? 0);
        expect(focusBox?.y).toBeLessThan(844);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
        ).toBe(true);

        await captureStepScreenshot(
          page,
          testInfo,
          "workspace/mobile-priority",
        );
      },
      { calendarMessages: [], calendarTokenCreated: false },
    );
  });

  test("中文总览周视图使用本地化星期标签", async ({
    page,
    account: _account,
    homeworkRun,
  }, testInfo) => {
    await homeworkRun(
      async () => {
        await gotoAndWaitForReady(page, "/workspace/overview");
        const localeResponse = await page.request.post(
          "/api/account/preferences",
          {
            data: { locale: "zh-cn" },
          },
        );
        expect(localeResponse.status()).toBe(200);
        await localeResponse.body();
        await gotoAndWaitForReady(page, "/workspace/overview");
        await expect(page.locator("html")).toHaveAttribute("lang", "zh-cn");

        const weekCard = page.getByTestId("workspace-overview-week");
        await expect(weekCard).toBeVisible();
        await expect(weekCard.getByText("周日", { exact: true })).toBeVisible();
        await expect(weekCard.getByText("Sun", { exact: true })).toHaveCount(0);
        await captureStepScreenshot(
          page,
          testInfo,
          "workspace/overview-week-zh-cn",
        );
      },
      { calendarMessages: [], calendarTokenCreated: false },
    );
  });
});
