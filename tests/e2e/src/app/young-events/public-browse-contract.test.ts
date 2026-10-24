import { expect, type Page } from "@playwright/test";
import {
  createYoungBrowseFixture,
  type YoungBrowseFixture,
} from "../../../../shared/young-browse-fixture";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test as workerTest } from "../../../utils/personal-preferences-fixture";
import {
  applyYoungTableFilters,
  fillYoungTableSearch,
  openYoungTableField,
  setYoungTableChoices,
} from "../../../utils/young-table-filters";

const root = "/catalog/young-events";
const test = workerTest.extend<{ fixture: YoungBrowseFixture }>({
  fixture: async ({ isolatedWorker, preferenceFlow }, use) => {
    await use(
      await preferenceFlow.prepare(() =>
        isolatedWorker.database.owner.$transaction(createYoungBrowseFixture),
      ),
    );
  },
});
function eventLink(page: Page, fixture: YoungBrowseFixture, index: number) {
  return page
    .locator(`a[href="${root}/${fixture.eventIds[index]}"]:visible`)
    .first();
}
// Browse links address the detail page directly, and it renders no in-page
// back link, so the browser history is what returns to the list.
async function returnFromDetail(
  page: Page,
  fixture: YoungBrowseFixture,
  index: number,
) {
  const origin = page.url();
  await eventLink(page, fixture, index).click();
  await expect(page).toHaveURL(
    (url) => url.pathname === `${root}/${fixture.eventIds[index]}`,
  );
  expect(new URL(page.url()).search).toBe("");
  expect(new URL(page.url()).hash).toBe("");
  await expect(
    page.getByRole("link", {
      name: /返回活动列表|Back to all events|返回日历|Back to calendar|返回主办方|Back to organizers/,
    }),
  ).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(origin);
}
async function openYoungSidebar(page: Page) {
  const sidebar = page.getByTestId("young-sidebar");
  if (!(await sidebar.isVisible()))
    await page.locator('[data-slot="sidebar-trigger"]').click();
  await expect(sidebar).toBeVisible();
  return sidebar;
}
function sharedContext(page: Page, expected: Record<string, string>) {
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toMatchObject(
    expected,
  );
}

for (const path of [root, `${root}/organizers`]) {
  test(`young-event.search-filter-literal-label ${path}`, {
    tag: "@Young/Web",
  }, async ({ page, preferenceFlow, isolatedWorker }) => {
    await preferenceFlow.run(async () => {
      const search = "alpha $` beta $& gamma $' delta $$ omega";
      for (const locale of ["en-us", "zh-cn"]) {
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
        await gotoAndWaitForReady(page, path);
        await fillYoungTableSearch(page, search);
        await applyYoungTableFilters(page);
        await expect
          .poll(() => {
            const url = new URL(page.url());
            return {
              pathname: url.pathname,
              search: url.searchParams.get("search"),
            };
          })
          .toEqual({ pathname: path, search });
        const applied = page.getByRole("group", {
          name: /已选条件|Applied filters/,
        });
        await expect(applied).toContainText(search);
        const field = await openYoungTableField(page, "search");
        await expect(field.locator("input")).toHaveValue(search);
        await field.locator("input").fill("");
        expect(new URL(page.url()).searchParams.get("search")).toBe(search);
        await applyYoungTableFilters(page);
        await expect
          .poll(() => {
            const url = new URL(page.url());
            return {
              pathname: url.pathname,
              search: url.searchParams.get("search"),
            };
          })
          .toEqual({ pathname: path, search: null });
        await expect(
          (await openYoungTableField(page, "search")).locator("input"),
        ).toHaveValue("");
        await page.keyboard.press("Escape");
        await expect(applied).toHaveCount(0);
      }
    });
  });
}

test("young table numeric comparisons run before pagination and preserve choices", {
  tag: "@Young/Web",
}, async ({ page, isolatedWorker, preferenceFlow }) => {
  const categories = ["Workshop, advanced", "100% practice"];
  await preferenceFlow.prepare(() =>
    isolatedWorker.database.owner.youngEvent.createMany({
      data: [
        ...Array.from({ length: 22 }, (_, index) => ({
          youngId: `numeric-event-${String(index).padStart(3, "0")}`,
          name: `Numeric filter event ${index}`,
          capacity: 20,
          appliedCount: 5,
          module: index % 2 ? "智" : "体",
          category: categories[index % 2],
          isActive: true,
          rawJson: {},
        })),
        {
          youngId: "numeric-event-capacity",
          name: "Numeric filter event low capacity",
          capacity: 19,
          appliedCount: 5,
          module: "智",
          category: categories[0],
          isActive: true,
          rawJson: {},
        },
        {
          youngId: "numeric-event-applied",
          name: "Numeric filter event high applications",
          capacity: 20,
          appliedCount: 6,
          module: "智",
          category: categories[0],
          isActive: true,
          rawJson: {},
        },
        {
          youngId: "numeric-event-module",
          name: "Numeric filter event other module",
          capacity: 20,
          appliedCount: 5,
          module: "劳",
          category: categories[0],
          isActive: true,
          rawJson: {},
        },
        {
          youngId: "numeric-event-category",
          name: "Numeric filter event other category",
          capacity: 20,
          appliedCount: 5,
          module: "智",
          category: "Other",
          isActive: true,
          rawJson: {},
        },
      ],
    }),
  );
  await preferenceFlow.run(async () => {
    const expected = {
      search: "Numeric filter event",
      module: "智,体",
      capacity: "20",
      capacityOp: "gte",
      appliedCount: "5",
      appliedCountOp: "lte",
    };
    const events = page.locator(
      'a[href^="/catalog/young-events/numeric-event-"]:visible',
    );
    await gotoAndWaitForReady(
      page,
      `${root}?${new URLSearchParams({
        ...expected,
        category: categories[0],
      })}`,
    );
    await expect(events).toHaveCount(11);
    await fillYoungTableSearch(page, "Numeric filter event");
    await setYoungTableChoices(page, "module", ["智", "体"]);
    await setYoungTableChoices(page, "category", categories);
    const capacity = await openYoungTableField(page, "capacity");
    await capacity.getByRole("combobox").selectOption("gte");
    await capacity.getByRole("spinbutton").fill("20");
    const applied = await openYoungTableField(page, "appliedCount");
    await applied.getByRole("combobox").selectOption("lte");
    await applied.getByRole("spinbutton").fill("5");
    await applyYoungTableFilters(page);
    await expect(page).toHaveURL(
      (url) => url.searchParams.getAll("category").length === 2,
    );
    sharedContext(page, expected);
    expect(new URL(page.url()).searchParams.getAll("category")).toEqual(
      categories,
    );
    for (const category of categories) {
      await expect(
        page.getByRole("group", { name: /已选条件|Applied filters/ }),
      ).toContainText(category);
    }
    await expect(events).toHaveCount(20);
    await page.getByRole("link", { name: /^(下一页|Next page)$/i }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("page") === "2");
    sharedContext(page, { ...expected, page: "2" });
    expect(new URL(page.url()).searchParams.getAll("category")).toEqual(
      categories,
    );
    await expect(events).toHaveCount(2);
    await expect(events).toContainText([
      "Numeric filter event 20",
      "Numeric filter event 21",
    ]);
    await expect(
      (await openYoungTableField(page, "module")).getByRole("checkbox", {
        checked: true,
      }),
    ).toHaveCount(2);
    await expect(
      (await openYoungTableField(page, "category")).getByRole("checkbox", {
        checked: true,
      }),
    ).toHaveCount(2);
  });
});

test("young-event.web-browse-context", { tag: "@Young/Web" }, async ({
  page,
  fixture,
  preferenceFlow,
}) => {
  await preferenceFlow.run(async () => {
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
      await gotoAndWaitForReady(
        page,
        `${root}?${new URLSearchParams(filters)}`,
      );
      await returnFromDetail(page, fixture, 0);
      sharedContext(page, filters);
      await expect(
        page
          .locator('[data-slot="table-column-header"]:visible')
          .getByRole("button", { name: /^(活动|Event)$/ }),
      ).toBeVisible();
      await expect(eventLink(page, fixture, 0)).toBeVisible();
      const calendarUrl = new URL(page.url());
      calendarUrl.pathname = `${root}/calendar`;
      calendarUrl.searchParams.set("date", "2035-09-15");
      calendarUrl.searchParams.set("view", "day");
      await gotoAndWaitForReady(
        page,
        calendarUrl.pathname + calendarUrl.search,
      );
      await returnFromDetail(page, fixture, 0);
      await gotoAndWaitForReady(
        page,
        `${root}/organizers/${fixture.organizerIds[0]}?page=1`,
      );
      await returnFromDetail(page, fixture, 0);
      await gotoAndWaitForReady(
        page,
        `${root}?${new URLSearchParams(filters)}`,
      );
      const sidebar = await openYoungSidebar(page);
      await sidebar
        .getByRole("link", { name: /^(活动日历|Event calendar)$/ })
        .click();
      await expect(page).toHaveURL(/\/catalog\/young-events\/calendar$/);
      await expect(
        page.locator("#main-content").getByRole("searchbox"),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /^(活动|Event)$/ }),
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
        const unknownDateLabel =
          timeBasis === "activity"
            ? /活动时间未知|Unknown activity date/
            : /报名时间未知|Unknown signup date/;
        const eventIndex = timeBasis === "activity" ? 7 : 10;
        await expect(applied).toContainText(unknownDateLabel);
        await expect(eventLink(page, fixture, eventIndex)).toBeVisible();
        const search = `${fixture.search} ${String(eventIndex).padStart(2, "0")}`;
        await fillYoungTableSearch(page, search);
        await applyYoungTableFilters(page);
        await expect(page).toHaveURL(
          (url) =>
            url.searchParams.get("search") === search &&
            url.searchParams.get("dateUnknown") === "true" &&
            url.searchParams.get("timeBasis") === timeBasis,
        );
        await expect(applied).toContainText(unknownDateLabel);
        await expect(eventLink(page, fixture, eventIndex)).toBeVisible();
        sharedContext(page, { search, dateUnknown: "true", timeBasis });
      }
      await gotoAndWaitForReady(
        page,
        `${root}?${new URLSearchParams({ search: fixture.search, dateUnknown: "true" })}`,
      );
      await expect(eventLink(page, fixture, 7)).toBeVisible();
      await expect(eventLink(page, fixture, 10)).toBeVisible();
      await expect(eventLink(page, fixture, 0)).toHaveCount(0);
      await expect(
        page.getByRole("group", { name: /已选条件|Applied filters/ }),
      ).toContainText(/任一时间未知|Either date unknown/);
      await setYoungTableChoices(page, "timeBasis", [
        "activity",
        "registration",
      ]);
      expect(new URL(page.url()).searchParams.has("timeBasis")).toBe(false);
      await applyYoungTableFilters(page);
      await expect(page).toHaveURL(
        (url) => url.searchParams.get("timeBasis") === "activity,registration",
      );
      await expect(eventLink(page, fixture, 7)).toBeVisible();
      await expect(eventLink(page, fixture, 10)).toBeVisible();
    }
  });
});

test("young-event.web-organizer-order", { tag: "@Young/Web" }, async ({
  page,
  fixture,
  preferenceFlow,
}) => {
  await preferenceFlow.run(async () => {
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
      await expect(page).toHaveURL(
        (url) => url.searchParams.get("page") === "2",
      );
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
        page
          .getByText(/未找到主办方|No organizers found/)
          .filter({ visible: true }),
      ).toBeVisible();
    }
  });
});

test("young-event.fixed-browse-filter-options", { tag: "@Young/Web" }, async ({
  page,
  fixture,
  preferenceFlow,
}) => {
  await preferenceFlow.run(async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(
      page,
      `${root}?${new URLSearchParams({ search: fixture.search })}`,
    );
    await expect(eventLink(page, fixture, 7)).toContainText("未知模块");
    await expect(eventLink(page, fixture, 7)).toContainText("未知级别");
    const metadata = eventLink(page, fixture, 7).getByTestId(
      "young-list-metadata",
    );
    await expect(metadata.locator('[data-slot="badge"]')).toHaveCount(3);
    await expect(metadata.getByText("未知模块", { exact: true })).toBeVisible();
    await expect(metadata.getByText("未知级别", { exact: true })).toBeVisible();
    await expect(
      metadata.getByText(`Z ${fixture.marker} tie`, { exact: true }),
    ).toBeVisible();
    // The calendar consumes the same filters from the URL but owns no filter UI.
    await gotoAndWaitForReady(
      page,
      `${root}/calendar?${new URLSearchParams({
        search: fixture.search,
        module: "未知模块",
        activityLevel: "未知级别",
        date: "2035-09-15",
        view: "day",
      })}`,
    );
    await expect(
      page.getByRole("button", { name: /^(活动|Event)$/ }),
    ).toHaveCount(0);
    {
      const path = root;
      const context = {
        search: fixture.search,
        module: "未知模块",
        activityLevel: "未知级别",
      };
      await gotoAndWaitForReady(
        page,
        `${path}?${new URLSearchParams(context)}`,
      );
      const applied = page.getByRole("group", {
        name: /已选条件|Applied filters/,
      });
      await expect(applied).toContainText("未知模块");
      await expect(applied).toContainText("未知级别");
      const module = await openYoungTableField(page, "module");
      await expect(
        module.getByRole("checkbox", { name: "未知模块", exact: true }),
      ).toBeChecked();
      await expect(
        module.getByRole("checkbox", { checked: false }),
      ).toHaveCount(5);
      for (const name of ["德", "智", "体", "美", "劳"])
        await expect(
          module.getByRole("checkbox", { name, exact: true }),
        ).toBeVisible();
      const level = await openYoungTableField(page, "activityLevel");
      await expect(
        level.getByRole("checkbox", { name: "未知级别", exact: true }),
      ).toBeChecked();
      await expect(level.getByRole("checkbox", { checked: false })).toHaveCount(
        5,
      );
      for (const name of ["班级", "院级", "校级", "省级", "国家级"])
        await expect(
          level.getByRole("checkbox", { name, exact: true }),
        ).toBeVisible();
      await applyYoungTableFilters(page);
      sharedContext(page, context);
      const primarySearch = `${fixture.search} 07`;
      await fillYoungTableSearch(page, primarySearch);
      await applyYoungTableFilters(page);
      await expect(page).toHaveURL(
        (url) => url.searchParams.get("search") === primarySearch,
      );
      sharedContext(page, { ...context, search: primarySearch });
      await setYoungTableChoices(page, "module", ["智"]);
      await setYoungTableChoices(page, "activityLevel", ["校级"]);
      sharedContext(page, { ...context, search: primarySearch });
      await applyYoungTableFilters(page);
      await expect(page).toHaveURL(
        (url) =>
          url.searchParams.get("module") === "智" &&
          url.searchParams.get("activityLevel") === "校级",
      );
      await gotoAndWaitForReady(
        page,
        `${path}?${new URLSearchParams(context)}`,
      );
      await setYoungTableChoices(page, "module", []);
      await applyYoungTableFilters(page);
      await expect(page).toHaveURL((url) => !url.searchParams.has("module"));
      expect(new URL(page.url()).searchParams.get("activityLevel")).toBe(
        "未知级别",
      );
      await setYoungTableChoices(page, "activityLevel", []);
      await applyYoungTableFilters(page);
      await expect(page).toHaveURL(
        (url) => !url.searchParams.has("activityLevel"),
      );
    }
  });
});
