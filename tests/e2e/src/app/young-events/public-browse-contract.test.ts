import { expect, type Page, test } from "@playwright/test";
import {
  cleanupYoungBrowseFixture,
  createYoungBrowseFixture,
  type YoungBrowseFixture,
} from "../../../../shared/young-browse-fixture";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

let fixture: YoungBrowseFixture;
const root = "/catalog/young-events";
test.beforeEach(async () => {
  fixture = await withE2ePrisma(createYoungBrowseFixture);
});
test.afterEach(async () => {
  await withE2ePrisma((db) => cleanupYoungBrowseFixture(db, fixture));
});
function eventLink(page: Page, index: number) {
  return page
    .locator(`a[href="${root}/${fixture.eventIds[index]}"]:visible`)
    .first();
}
async function openYoungSidebar(page: Page) {
  const sidebar = page.getByTestId("young-sidebar");
  if (!(await sidebar.isVisible())) {
    await page.locator('[data-slot="sidebar-trigger"]').click();
  }
  await expect(sidebar).toBeVisible();
  return sidebar;
}
function sharedContext(page: Page, expected: Record<string, string>) {
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toMatchObject(
    expected,
  );
}

test("young-event.web-browse-context", async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const filters = {
      search: fixture.search,
      category: fixture.category,
      module: "智",
      activityLevel: "校级",
      organizerId: fixture.organizerIds[0],
      active: "true",
      timeBasis: "activity",
    };
    await gotoAndWaitForReady(page, `${root}?${new URLSearchParams(filters)}`);
    sharedContext(page, filters);
    await expect(
      page.locator("#main-content").getByRole("searchbox"),
    ).toBeVisible();
    await expect(eventLink(page, 0)).toBeVisible();
    const sidebar = await openYoungSidebar(page);
    await sidebar
      .getByRole("link", { name: /^(活动日历|Event calendar)$/ })
      .click();
    await expect(page).toHaveURL(/\/catalog\/young-events\/calendar$/);
    await expect(
      page.locator("#main-content").getByRole("searchbox"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /更多筛选|More filters/ }),
    ).toHaveCount(0);
    const listNav = await openYoungSidebar(page);
    await listNav
      .getByRole("link", { name: /^(活动列表|Activity list)$/ })
      .click();
    await expect(page).toHaveURL(/\/catalog\/young-events$/);
    for (const timeBasis of ["activity", "registration"]) {
      await gotoAndWaitForReady(
        page,
        `${root}?${new URLSearchParams({ search: fixture.search, dateUnknown: "true", timeBasis })}`,
      );
      const applied = page.getByRole("group", {
        name: /已选条件|Applied filters/,
      });
      await expect(applied).toContainText(
        timeBasis === "activity"
          ? /活动时间未知|Unknown activity date/
          : /报名时间未知|Unknown signup date/,
      );
      await expect(
        eventLink(page, timeBasis === "activity" ? 7 : 10),
      ).toBeVisible();
      await page.getByRole("button", { name: /^(搜索|Search)$/ }).click();
      await expect(page).toHaveURL(
        (url) => url.searchParams.get("dateUnknown") === "true",
      );
      sharedContext(page, { dateUnknown: "true", timeBasis });
    }
  }
});

test("young-event.web-organizer-order", async ({ page }) => {
  const webOrder = [
    ...fixture.organizerIds.slice(0, 6),
    ...fixture.organizerIds.slice(12),
    ...fixture.organizerIds.slice(6, 12),
  ];
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await gotoAndWaitForReady(
      page,
      `${root}/organizers?${new URLSearchParams({ search: fixture.marker })}`,
    );
    const organizerLinks = page.locator(
      `#main-content a[href^="${root}/organizers/${fixture.marker}"]:visible`,
    );
    const ids = () =>
      organizerLinks.evaluateAll((elements) =>
        elements.map((element) =>
          element.getAttribute("href")?.split("/").at(-1),
        ),
      );
    expect(await ids()).toEqual(webOrder.slice(0, 20));
    await page.getByRole("link", { name: /下一页|Next page/ }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("page") === "2");
    sharedContext(page, { search: fixture.marker });
    expect(await ids()).toEqual(webOrder.slice(20));
    await organizerLinks.first().click();
    await expect(page).toHaveURL(`${root}/organizers/${webOrder[20]}`);
    await gotoAndWaitForReady(
      page,
      `${root}/organizers?${new URLSearchParams({ search: fixture.marker, page: "3" })}`,
    );
    await expect(organizerLinks).toHaveCount(0);
    await expect(
      page.getByText(/未找到主办方|No organizers found/),
    ).toBeVisible();
  }
});

test("young-event.fixed-browse-filter-options", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndWaitForReady(
    page,
    `${root}?${new URLSearchParams({ search: fixture.search })}`,
  );
  await expect(eventLink(page, 7)).toContainText("未知模块");
  await expect(eventLink(page, 7)).toContainText("未知级别");
  await gotoAndWaitForReady(page, `${root}/calendar?date=2035-09-15&view=day`);
  await expect(
    page.getByRole("button", { name: /更多筛选|More filters/ }),
  ).toHaveCount(0);
  {
    const prefix = "young-event";
    const path = root;
    const context = {
      search: fixture.search,
      module: "未知模块",
      activityLevel: "未知级别",
    };
    await gotoAndWaitForReady(page, `${path}?${new URLSearchParams(context)}`);
    const applied = page.getByRole("group", {
      name: /已选条件|Applied filters/,
    });
    await expect(applied).toContainText("未知模块");
    await expect(applied).toContainText("未知级别");
    await page.getByRole("button", { name: /更多筛选|More filters/ }).click();
    const dialog = page.getByRole("dialog");
    const module = dialog.locator(`#${prefix}-module`);
    const level = dialog.locator(`#${prefix}-activity-level`);
    await page.screenshot({
      path: testInfo.outputPath("unknown-filter-context-events.png"),
    });
    expect(
      await module
        .locator("option:not([disabled])")
        .evaluateAll((options) =>
          options.map((option) => (option as HTMLOptionElement).value),
        ),
    ).toEqual(["", "德", "智", "体", "美", "劳"]);
    expect(
      await level
        .locator("option:not([disabled])")
        .evaluateAll((options) =>
          options.map((option) => (option as HTMLOptionElement).value),
        ),
    ).toEqual(["", "班级", "院级", "校级", "省级", "国家级"]);
    await expect(module).toHaveValue("未知模块");
    await expect(level).toHaveValue("未知级别");
    await dialog.getByRole("button", { name: /^(搜索|Search)$/ }).click();
    await expect(dialog).toBeHidden();
    sharedContext(page, context);
    const primarySearch = `${fixture.search} 07`;
    await page.getByRole("searchbox").fill(primarySearch);
    await page.getByRole("button", { name: /^(搜索|Search)$/ }).click();
    await expect(page).toHaveURL(
      (url) => url.searchParams.get("search") === primarySearch,
    );
    sharedContext(page, { ...context, search: primarySearch });
    await page.getByRole("button", { name: /更多筛选|More filters/ }).click();
    await expect(dialog).toBeVisible();
    await module.selectOption("智");
    await level.selectOption("校级");
    await dialog.getByRole("button", { name: /^(搜索|Search)$/ }).click();
    await expect(page).toHaveURL(
      (url) =>
        url.searchParams.get("module") === "智" &&
        url.searchParams.get("activityLevel") === "校级",
    );
    await gotoAndWaitForReady(page, `${path}?${new URLSearchParams(context)}`);
    await applied.getByRole("link", { name: /未知模块/ }).click();
    await expect(page).toHaveURL((url) => !url.searchParams.has("module"));
    expect(new URL(page.url()).searchParams.get("activityLevel")).toBe(
      "未知级别",
    );
    await applied.getByRole("link", { name: /未知级别/ }).click();
    await expect(page).toHaveURL(
      (url) => !url.searchParams.has("activityLevel"),
    );
  }
});
