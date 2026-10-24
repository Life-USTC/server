/**
 * E2E tests for /catalog/young-events — 第二课堂活动列表
 *
 * ## Data Represented
 * - Signup events from young.ustc.edu.cn with name, category, event time,
 *   signup window, capacity, and registration status
 * - Seed events: DEV_SEED.youngEvent (active) + dev-scenario-young-event-ended
 *
 * ## UI/UX Elements
 * - Search input (searchbox) with submit and clear buttons
 * - Shared filter drafts with multiple choices and one Apply action
 * - Date-grouped rows with links to /catalog/young-events/{youngId}
 * - URL-driven pagination
 * - Empty state when no events match
 *
 * ## Edge Cases
 * - SSR output contains the search query for SEO
 * - Non-matching search shows the empty state instead of an error
 */
import { expect } from "@playwright/test";
import type {
  YoungEvent,
  YoungOrganizer,
} from "../../../../../src/generated/prisma-node/client";
import {
  expectPrivateViewerState,
  preparePrivateViewer,
} from "../../../utils/authenticated-read-fixture";
import { DEV_SEED } from "../../../utils/dev-seed";
import { visibleText } from "../../../utils/locators";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test as privateTest } from "../../../utils/personal-preferences-fixture";
import { test } from "../../../utils/young-public-fixture";
import {
  applyYoungTableFilters,
  fillYoungTableSearch,
  openYoungTableField,
  setYoungTableChoices,
} from "../../../utils/young-table-filters";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/catalog/young-events 第二课堂活动", () => {
  test("页面契约", { tag: "@Young/Web" }, async ({
    page,
    preferenceFlow,
    youngPublicState: _youngPublicState,
  }) => {
    await preferenceFlow.run(async () => {
      await assertPageContract(page, {
        routePath: "/catalog/young-events",
      });
    });
  });

  for (const { title, route, query } of [
    {
      title: "SSR 输出包含搜索查询",
      route: "/catalog/young-events",
      query: DEV_SEED.youngEvent.name,
    },
    {
      title: "主办方 SSR 搜索框保留查询",
      route: "/catalog/young-events/organizers",
      query: DEV_SEED.youngEvent.organizer,
    },
  ]) {
    test(title, { tag: "@Young/Web" }, async ({
      page,
      preferenceFlow,
      youngPublicState: _youngPublicState,
    }) => {
      await preferenceFlow.run(async () => {
        const response = await preferenceFlow.http(() =>
          page.request.get(`${route}?search=${encodeURIComponent(query)}`),
        );
        expect(response.status()).toBe(200);
        const html = await response.text();
        expect(html).toContain('id="main-content"');
        expect(html).toContain(query);
        // DOMParser keeps the response inert; client effects cannot repair it.
        const submittedSearch = await page.evaluate((markup) => {
          const document = new DOMParser().parseFromString(markup, "text/html");
          return Array.from(
            document.querySelectorAll<HTMLInputElement>('input[name="search"]'),
            (input) => input.value,
          );
        }, html);
        expect(submittedSearch.length).toBeGreaterThan(0);
        for (const value of submittedSearch) expect(value).toBe(query);
      });
    });
  }

  test("搜索、报名状态筛选与清除按钮", { tag: "@Young/Web" }, async ({
    page,
    preferenceFlow,
    youngPublicState: _youngPublicState,
  }) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(page, "/catalog/young-events");
      await expect(
        page
          .getByRole("link", { name: new RegExp(DEV_SEED.youngEvent.name) })
          .first(),
      ).toBeVisible();

      await fillYoungTableSearch(page, DEV_SEED.youngEvent.name);
      await applyYoungTableFilters(page);
      await page.waitForURL(/[?&]search=/);
      await expect(
        visibleText(page, DEV_SEED.youngEvent.name).first(),
      ).toBeVisible();

      await fillYoungTableSearch(page, "");
      await setYoungTableChoices(page, "active", ["false"]);
      await applyYoungTableFilters(page);
      await page.waitForURL(/active=false/);
      await expect(
        page.getByRole("link", { name: /已结束活动/ }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("link", {
          name: new RegExp(DEV_SEED.youngEvent.name),
        }),
      ).toHaveCount(0);

      await page
        .locator('[data-slot="table-filter-apply"]')
        .getByRole("button", { name: /^(?:清除|Clear)$/i })
        .click();
      await applyYoungTableFilters(page);
      await expect(page).toHaveURL(
        (url) =>
          url.pathname === "/catalog/young-events" &&
          !url.searchParams.has("active"),
      );
      await expect(
        page
          .getByRole("link", { name: new RegExp(DEV_SEED.youngEvent.name) })
          .first(),
      ).toBeVisible();
    });
  });

  test("status column filters match localized fallback badges", {
    tag: "@Young/Web",
  }, async ({
    page,
    isolatedWorker,
    preferenceFlow,
    youngPublicState: _youngPublicState,
  }) => {
    await preferenceFlow.run(async () => {
      for (const [locale, activeStatus, endedStatus] of [
        ["en-us", "SIGNUP", "Ended"],
        ["zh-cn", "报名中", "已结束"],
      ]) {
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
        await gotoAndWaitForReady(page, "/catalog/young-events");
        for (const [status, active] of [
          [activeStatus, true],
          [endedStatus, false],
        ] as const) {
          const field = await openYoungTableField(page, "status");
          await field.locator("input").fill(status);
          await applyYoungTableFilters(page);
          await expect(page).toHaveURL(
            (url) => url.searchParams.get("status") === status,
          );
          await expect(
            page.locator(
              `a[href="/catalog/young-events/${DEV_SEED.youngEvent.youngId}"]:visible`,
            ),
          ).toHaveCount(active ? 1 : 0);
          await expect(
            page.locator(
              'a[href="/catalog/young-events/dev-scenario-young-event-ended"]:visible',
            ),
          ).toHaveCount(active ? 0 : 1);
        }
      }
    });
  });

  test("筛选面板保值，详情可返回，边栏进入日历", { tag: "@Young/Web" }, async ({
    page,
    preferenceFlow,
    youngPublicState: _youngPublicState,
  }) => {
    await preferenceFlow.run(async () => {
      const search = encodeURIComponent(DEV_SEED.youngEvent.name);
      await gotoAndWaitForReady(
        page,
        `/catalog/young-events?search=${search}&organizerId=dev-scenario-young-organizer`,
      );
      const organizer = await openYoungTableField(page, "organizerId");
      await expect(
        organizer.getByRole("checkbox", { checked: true }),
      ).toHaveCount(1);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
      await applyYoungTableFilters(page);
      await expect(page).toHaveURL(/organizerId=dev-scenario-young-organizer/);
      await expect(
        page.getByRole("group", { name: /已选条件|Applied filters/ }),
      ).toBeVisible();
      const browseUrl = page.url();
      await page
        .locator(
          `a[href="/catalog/young-events/${DEV_SEED.youngEvent.youngId}"]`,
        )
        .filter({ visible: true })
        .first()
        .click();
      await expect(page).toHaveURL(
        new URL(
          `/catalog/young-events/${DEV_SEED.youngEvent.youngId}`,
          browseUrl,
        ).toString(),
      );
      await expect(page.getByTestId("young-event-banner")).toBeVisible();
      await expect(
        page.getByRole("link", { name: /返回活动列表|Back to all events/ }),
      ).toHaveCount(0);
      await page.goBack();
      await expect(page).toHaveURL(browseUrl);
      const youngNav = page.getByTestId("young-sidebar");
      await expect(youngNav).toBeVisible();
      await expect(page.getByTestId("young-sidebar-back")).toHaveAttribute(
        "href",
        "/",
      );
      await expect(
        youngNav.getByRole("link", { name: /^(?:活动列表|Activity list)$/ }),
      ).toHaveAttribute("aria-current", "page");
      await expect(
        youngNav.getByRole("link", {
          name: new RegExp(DEV_SEED.youngEvent.name),
        }),
      ).toHaveCount(0);
      await youngNav
        .getByRole("link", { name: /^(?:活动日历|Event calendar)$/ })
        .click();
      await expect(page).toHaveURL(/\/catalog\/young-events\/calendar$/);
    });
  });

  test("手机日历从所选日期开始并可展开此前日期", { tag: "@Young/Web" }, async ({
    page,
    preferenceFlow,
  }) => {
    await preferenceFlow.run(async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoAndWaitForReady(
        page,
        "/catalog/young-events/calendar?view=month&date=2026-09-25",
      );
      const calendar = page.getByTestId("young-calendar");
      await expect(
        calendar.getByRole("link", { name: /^(月|Month)$/ }),
      ).toHaveAttribute("aria-current", "page");
      const headings = page
        .getByTestId("young-calendar-agenda")
        .getByRole("heading", { level: 3 });
      await expect(headings.first()).toHaveAttribute(
        "id",
        "young-agenda-2026-09-25",
      );
      await calendar
        .getByRole("button", { name: /查看此前日期|Show earlier dates/ })
        .click();
      await expect(page.locator("#young-agenda-2026-09-01")).toBeVisible();
      await expect(page.locator("#young-agenda-2026-08-31")).toHaveCount(0);
    });
  });

  test("无匹配活动时显示明确空状态", { tag: "@Young/Web" }, async ({
    page,
    preferenceFlow,
  }) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(
        page,
        "/catalog/young-events?search=e2e-no-matching-young-event-7f3c9a",
      );

      await expect(
        page.getByText(/未找到活动|No events found/i).filter({ visible: true }),
      ).toBeVisible();
      await expect(
        page.locator(
          "#main-content a[href^='/catalog/young-events/dev-scenario-']",
        ),
      ).toHaveCount(0);
    });
  });

  test("日历和主办方页面保留公开深链接", { tag: "@Young/Web" }, async ({
    page,
    preferenceFlow,
    youngPublicState: _youngPublicState,
  }) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(
        page,
        "/catalog/young-events/calendar?view=month&date=2026-05-10",
      );
      await expect(page.getByTestId("young-calendar")).toBeVisible();
      await expect(
        page.getByRole("link", { name: /日|Day/i }).first(),
      ).toBeVisible();

      await gotoAndWaitForReady(page, "/catalog/young-events/organizers");
      await expect(
        (await openYoungTableField(page, "search")).locator("input"),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(
        page
          .getByText(/学生会|Students'? Union/i)
          .filter({ visible: true })
          .first(),
      ).toBeVisible();
      await expect(
        page
          .locator(
            "a[href='/catalog/young-events/organizers/dev-scenario-young-organizer']",
          )
          .filter({ visible: true }),
      ).toBeVisible();
    });
  });
});

for (const width of [1280, 390]) {
  test(`column filters retain shared drafts and apply them together at ${width}px`, {
    tag: "@Young/Web",
  }, async ({ page, preferenceFlow, youngPublicState: _youngPublicState }) => {
    await preferenceFlow.run(async () => {
      await page.setViewportSize({ width, height: 844 });
      await gotoAndWaitForReady(
        page,
        "/catalog/young-events?search=applied&organizerId=dev-scenario-young-organizer&module=智",
      );
      const search = `unsubmitted-search-${width}`;
      await fillYoungTableSearch(page, search);
      await setYoungTableChoices(page, "module", ["体", "劳"]);
      await setYoungTableChoices(page, "organizerId", []);
      expect(new URL(page.url()).searchParams.get("search")).toBe("applied");
      expect(new URL(page.url()).searchParams.get("module")).toBe("智");
      const module = await openYoungTableField(page, "module");
      await expect(
        module.getByRole("checkbox", { name: "体", exact: true }),
      ).toBeChecked();
      await expect(
        module.getByRole("checkbox", { name: "劳", exact: true }),
      ).toBeChecked();
      await expect(
        module.getByRole("checkbox", { name: "智", exact: true }),
      ).not.toBeChecked();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: /^(应用筛选|Apply filters)$/i }),
      ).toHaveCount(1);
      await applyYoungTableFilters(page);
      await expect(page).toHaveURL(
        (url) =>
          url.searchParams.get("search") === search &&
          url.searchParams.get("module") === "体,劳" &&
          !url.searchParams.has("organizerId"),
      );
      await expect(page.getByRole("dialog")).toBeHidden();
      await expect(
        (await openYoungTableField(page, "search")).locator("input"),
      ).toHaveValue(search);
    });
  });
}

for (const width of [1280, 390]) {
  privateTest(
    `calendar has all pages, day drilldown, and independent registration times at ${width}px`,
    { tag: "@Young/Web" },
    async ({ page, isolatedWorker, preferenceFlow, run }) => {
      await run(async () => {
        const db = isolatedWorker.database.owner;
        const events: YoungEvent[] = [];
        const organizers: YoungOrganizer[] = [];
        await preferenceFlow.run(async () => {
          const marker = `browser-young-${crypto.randomUUID()}`;
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          const organizer = await db.youngOrganizer.create({
            data: { id: marker, name: marker, normalizedName: marker },
          });
          organizers.push(organizer);
          await db.youngEvent.createMany({
            data: Array.from({ length: 106 }, (_, index) => ({
              youngId: `${marker}-${String(index).padStart(3, "0")}`,
              name: `Calendar activity ${String(index).padStart(3, "0")}`,
              organizerId: marker,
              isActive: true,
              rawJson: {},
              startAt: new Date("2035-09-15T10:00:00+08:00"),
              endAt: new Date("2035-09-15T12:00:00+08:00"),
              applyStartAt: new Date("2035-09-14T08:00:00+08:00"),
              applyEndAt: new Date("2035-09-14T18:00:00+08:00"),
            })),
          });
          events.push(
            ...(await db.youngEvent.findMany({
              orderBy: { youngId: "asc" },
            })),
          );
          expect(events).toHaveLength(106);
          await page.setViewportSize({ width, height: 844 });
          await gotoAndWaitForReady(
            page,
            `/catalog/young-events/calendar?view=month&date=2035-09-15&organizerId=${marker}`,
          );
          const root = page.getByTestId("young-calendar");
          if (width > 700)
            await root
              .getByRole("link", { name: /^(?:还有 103 场|103 more)$/ })
              .click();
          else await root.getByRole("link", { name: /^(日|Day)$/ }).click();
          await expect(page).toHaveURL(/view=day/);
          await expect(
            root
              .getByRole("link", { name: /Calendar activity 105/ })
              .filter({ visible: true }),
          ).toBeVisible();
          await root.getByRole("link", { name: /^(周|Week)$/ }).click();
          await expect(page).toHaveURL(/view=week/);
          // The calendar keeps filters in its own links; it no longer renders
          // filter controls, so the registration basis arrives through the URL.
          await gotoAndWaitForReady(
            page,
            `/catalog/young-events/calendar?view=week&date=2035-09-15&organizerId=${marker}&timeBasis=registration`,
          );
          await expect(
            root.getByRole("link", { name: /^(日|Day)$/ }),
          ).toHaveAttribute("href", /timeBasis=registration/);
          await root.getByRole("link", { name: /^(日|Day)$/ }).click();
          await expect(page).toHaveURL(/view=day/);
          await expect(page).toHaveURL(/timeBasis=registration/);
          await expect(
            root
              .getByRole("link", { name: /Calendar activity/ })
              .filter({ visible: true }),
          ).toHaveCount(0);
          await root
            .getByRole("link", { name: /^(上一段|Previous|上一)/ })
            .first()
            .click();
          await expect(
            root
              .getByRole("link", { name: /Calendar activity 105/ })
              .filter({ visible: true }),
          ).toBeVisible();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          ).toBe(true);

          expect(errors).toEqual([]);
        });
        expect(
          await db.youngEvent.findMany({ orderBy: { youngId: "asc" } }),
        ).toEqual(events);
        expect(await db.youngOrganizer.findMany()).toEqual(organizers);
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
    `calendar conflicts resolve independently of unavailable shell navigation (${status})`,
    { tag: "@Young/Web" },
    async ({ page, isolatedWorker, preferenceFlow, run }) => {
      await run(async () => {
        const viewer = await preferenceFlow.prepare(() =>
          preparePrivateViewer(page, isolatedWorker, false),
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
            "**/api/workspace/calendar/events?*",
            async (route) => {
              await route.fulfill({
                status,
                contentType: "application/json",
                body: JSON.stringify(
                  status === 200
                    ? {
                        data: [],
                        pagination: {
                          page: 1,
                          pageSize: 100,
                          total: 0,
                          totalPages: 0,
                        },
                      }
                    : { error: "Unauthorized" },
                ),
              });
            },
          );
          await gotoAndWaitForReady(page, "/catalog/young-events/calendar");
          await expect(
            page.getByTestId("young-calendar-conflict-status"),
          ).toContainText(
            status === 200 ? /仅基于|Conflicts use/ : /登录后|Sign in/,
          );
          await expect.poll(() => bootstrapRequests).toBe(1);
        });
        await expectPrivateViewerState(
          isolatedWorker.database.owner,
          viewer,
          [],
        );
      });
    },
  );
}
