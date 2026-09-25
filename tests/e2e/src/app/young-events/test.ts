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
 * - Signup status and category selects (native comboboxes)
 * - Desktop table / mobile item list with links to /catalog/young-events/{youngId}
 * - URL-driven pagination
 * - Empty state when no events match
 *
 * ## Edge Cases
 * - SSR output contains the search query for SEO
 * - Non-matching search shows the empty state instead of an error
 */
import { expect, test } from "@playwright/test";
import { createFixturePrisma } from "../../../../shared/prisma";
import { signInAsDebugUser } from "../../../utils/auth";
import { DEV_SEED } from "../../../utils/dev-seed";
import { visibleText } from "../../../utils/locators";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { absoluteTestUrl } from "../../../utils/request-url";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/catalog/young-events 第二课堂活动", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/catalog/young-events",
      testInfo,
    });
  });

  test("SSR 输出包含搜索查询", async ({ baseURL }) => {
    const response = await fetch(
      absoluteTestUrl(
        `/catalog/young-events?search=${encodeURIComponent(DEV_SEED.youngEvent.name)}`,
        baseURL,
      ),
    );
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('id="main-content"');
    expect(html).toContain(DEV_SEED.youngEvent.name);
  });

  test("搜索、报名状态筛选与清除按钮", async ({ page }) => {
    await gotoAndWaitForReady(page, "/catalog/young-events");
    await expect(
      page
        .getByRole("link", { name: new RegExp(DEV_SEED.youngEvent.name) })
        .first(),
    ).toBeVisible();

    const searchbox = page.getByRole("searchbox");
    await searchbox.fill(DEV_SEED.youngEvent.name);
    await page.getByRole("button", { name: /^(?:搜索|Search)$/i }).click();
    await page.waitForURL(/[?&]search=/);
    await expect(
      visibleText(page, DEV_SEED.youngEvent.name).first(),
    ).toBeVisible();

    await searchbox.fill("");
    await page
      .getByRole("combobox", { name: /活动范围|Activity scope/i })
      .selectOption("false");
    await page.getByRole("button", { name: /^(?:搜索|Search)$/i }).click();
    await page.waitForURL(/active=false/);
    await expect(
      page.getByRole("link", { name: /已结束活动/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: new RegExp(DEV_SEED.youngEvent.name),
      }),
    ).toHaveCount(0);

    await page.getByRole("link", { name: /^(?:清除|Clear)$/i }).click();
    await page.waitForURL(/\/catalog\/young-events$/);
    await expect(
      page
        .getByRole("link", { name: new RegExp(DEV_SEED.youngEvent.name) })
        .first(),
    ).toBeVisible();
  });

  test("筛选面板保值并在日历与详情之间保留上下文", async ({ page }) => {
    const search = encodeURIComponent(DEV_SEED.youngEvent.name);
    await gotoAndWaitForReady(
      page,
      `/catalog/young-events?search=${search}&organizerId=dev-scenario-young-organizer`,
    );
    const organizer = page.locator("#young-event-organizer");
    await expect(organizer).toBeHidden();
    await page.getByRole("button", { name: /更多筛选|More filters/ }).click();
    await expect(organizer).toBeVisible();
    await expect(organizer).toHaveValue("dev-scenario-young-organizer");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await Promise.all([
      page.waitForURL((url) => url.searchParams.has("timeBasis")),
      page.getByRole("button", { name: /^(搜索|Search)$/ }).click(),
    ]);
    await expect(page).toHaveURL(/organizerId=dev-scenario-young-organizer/);
    await expect(
      page.getByRole("group", { name: /已选条件|Applied filters/ }),
    ).toBeVisible();
    const browseUrl = page.url();
    await page
      .locator(
        `a[href^="/catalog/young-events/${DEV_SEED.youngEvent.youngId}?"]`,
      )
      .filter({ visible: true })
      .first()
      .click();
    await expect(page).toHaveURL(/returnTo=/);
    await expect(page.getByTestId("young-event-overview")).toBeVisible();
    await page
      .getByRole("link", { name: /返回活动列表|Back to all events/ })
      .click();
    await expect(page).toHaveURL(browseUrl);
    await page
      .getByTestId("young-browse-nav")
      .getByRole("link", { name: /^(日历|Calendar)$/ })
      .click();
    await expect(page).toHaveURL(/calendar\?/);
    expect(new URL(page.url()).searchParams.get("search")).toBe(
      DEV_SEED.youngEvent.name,
    );
    expect(new URL(page.url()).searchParams.get("organizerId")).toBe(
      "dev-scenario-young-organizer",
    );
  });

  test("手机日历从所选日期开始并可展开此前日期", async ({ page }) => {
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

  test("无匹配活动时显示明确空状态", async ({ page }) => {
    await gotoAndWaitForReady(
      page,
      "/catalog/young-events?search=e2e-no-matching-young-event-7f3c9a",
    );

    await expect(page.getByText(/未找到活动|No events found/i)).toBeVisible();
    await expect(
      page.locator(
        "#main-content a[href^='/catalog/young-events/dev-scenario-']",
      ),
    ).toHaveCount(0);
  });

  test("日历和主办方页面保留公开深链接", async ({ page }) => {
    await gotoAndWaitForReady(
      page,
      "/catalog/young-events/calendar?view=month&date=2026-05-10",
    );
    await expect(page.getByTestId("young-calendar")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /日|Day/i }).first(),
    ).toBeVisible();

    await gotoAndWaitForReady(page, "/catalog/young-events/organizers");
    await expect(page.getByRole("searchbox")).toBeVisible();
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

for (const width of [1280, 390]) {
  test(`advanced filter sheet isolates canceled drafts and submits the current search at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await gotoAndWaitForReady(
      page,
      "/catalog/young-events?search=applied&organizerId=dev-scenario-young-organizer&module=智",
    );
    const search = `unsubmitted-search-${width}`;
    await page.getByRole("searchbox").fill(search);
    const trigger = page.getByRole("button", { name: /更多筛选|More filters/ });
    const sheet = page.getByRole("dialog", { name: /更多筛选|More filters/ });
    await trigger.click();
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('input[name="search"]')).toHaveValue(search);
    await sheet.locator("#young-event-module").selectOption("体");
    await sheet.locator("#young-event-organizer").selectOption("");
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("searchbox")).toHaveValue(search);
    await page.getByRole("button", { name: /^(搜索|Search)$/ }).click();
    await expect(page).toHaveURL(
      (url) => url.searchParams.get("search") === search,
    );
    expect(new URL(page.url()).searchParams.get("module")).toBe("智");
    expect(new URL(page.url()).searchParams.get("organizerId")).toBe(
      "dev-scenario-young-organizer",
    );
    await trigger.click();
    await expect(sheet.locator("#young-event-module")).toHaveValue("智");
    await expect(sheet.locator("#young-event-organizer")).toHaveValue(
      "dev-scenario-young-organizer",
    );
    await sheet.locator("#young-event-module").selectOption("劳");
    await sheet.getByRole("button", { name: /^(搜索|Search)$/ }).click();
    await expect(page).toHaveURL(
      (url) => url.searchParams.get("module") === "劳",
    );
    await expect(sheet).toBeHidden();
    expect(new URL(page.url()).searchParams.get("search")).toBe(search);
    expect(new URL(page.url()).searchParams.get("organizerId")).toBe(
      "dev-scenario-young-organizer",
    );
  });
}

test("calendar sheet preserves selected dates and unsubmitted primary filters", async ({
  page,
}) => {
  await gotoAndWaitForReady(
    page,
    "/catalog/young-events/calendar?view=week&date=2035-09-15&category=sport",
  );
  await page.getByRole("searchbox").fill("calendar draft");
  await page.locator("#young-calendar-active").selectOption("false");
  await page.locator("#young-calendar-time-basis").selectOption("registration");
  await page.getByRole("button", { name: /更多筛选|More filters/ }).click();
  const sheet = page.getByRole("dialog", { name: /更多筛选|More filters/ });
  await sheet.locator("#young-calendar-module").selectOption("智");
  await sheet.getByRole("button", { name: /^(搜索|Search)$/ }).click();
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("module") === "智",
  );
  const params = new URL(page.url()).searchParams;
  expect(Object.fromEntries(params)).toMatchObject({
    view: "week",
    date: "2035-09-15",
    search: "calendar draft",
    active: "false",
    timeBasis: "registration",
    category: "sport",
  });
});

for (const width of [1280, 390]) {
  test(`calendar has all pages, day drilldown, and independent registration times at ${width}px`, async ({
    page,
  }) => {
    const db = createFixturePrisma();
    const marker = `browser-young-${crypto.randomUUID()}`;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await db.youngOrganizer.create({
      data: { id: marker, name: marker, normalizedName: marker },
    });
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
    try {
      await page.setViewportSize({ width, height: 844 });
      await gotoAndWaitForReady(
        page,
        `/catalog/young-events/calendar?view=month&date=2035-09-15&organizerId=${marker}`,
      );
      const root = page.getByTestId("young-calendar");
      if (width > 700)
        await root.getByRole("link", { name: "+101", exact: true }).click();
      else await root.getByRole("link", { name: /^(日|Day)$/ }).click();
      await expect(page).toHaveURL(/view=day/);
      await expect(
        root
          .getByRole("link", { name: /Calendar activity 105/ })
          .filter({ visible: true }),
      ).toBeVisible();
      await root.getByRole("link", { name: /^(周|Week)$/ }).click();
      await expect(page).toHaveURL(/view=week/);
      await page
        .locator("#young-calendar-time-basis")
        .selectOption("registration");
      await page.getByRole("button", { name: /^(搜索|Search)$/ }).click();
      await expect(page).toHaveURL(/timeBasis=registration/);
      await expect(
        root.getByRole("link", { name: /^(日|Day)$/ }),
      ).toHaveAttribute("href", /timeBasis=registration/);
      await root.getByRole("link", { name: /^(日|Day)$/ }).click();
      await expect(page).toHaveURL(/view=day/);
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
      await page.screenshot({
        path: `/tmp/young-calendar-${width}.png`,
        fullPage: true,
      });
      expect(errors).toEqual([]);
    } finally {
      await db.youngEvent.deleteMany({ where: { organizerId: marker } });
      await db.youngOrganizer.delete({ where: { id: marker } });
      await db.$disconnect();
    }
  });
}

for (const status of [200, 401]) {
  test(`calendar conflicts resolve independently of unavailable shell navigation (${status})`, async ({
    page,
  }) => {
    await signInAsDebugUser(page, "/workspace/overview");
    const session = await (
      await page.request.get("/api/auth/get-session")
    ).json();
    let bootstrapRequests = 0;
    await page.route("**/_internal/shell-bootstrap", async (route) => {
      bootstrapRequests++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ viewer: session.user, navigation: null }),
      });
    });
    await page.route("**/api/workspace/calendar/events?*", async (route) => {
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(
          status === 200
            ? {
                data: [],
                pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
              }
            : { error: "Unauthorized" },
        ),
      });
    });
    await gotoAndWaitForReady(page, "/catalog/young-events/calendar");
    await expect(
      page.getByTestId("young-calendar-conflict-status"),
    ).toContainText(status === 200 ? /仅基于|Conflicts use/ : /登录后|Sign in/);
    await expect.poll(() => bootstrapRequests).toBe(1);
  });
}
