import { expect, type Page } from "@playwright/test";
import { expectNoPageHorizontalOverflow } from "../../../utils/page-ready";
import { busTest as test } from "../../../utils/personal-preferences-fixture";

async function apply(page: Page) {
  await page.keyboard.press("Escape");
  const button = page.getByRole("button", {
    name: "Apply filters",
    exact: true,
  });
  await expect(button).toHaveCount(1);
  await button.click();
}

async function stationFilter(page: Page, name: string) {
  await page
    .getByTestId("bus-route-section")
    .getByRole("button", { name, exact: true })
    .first()
    .click();
  return page.getByRole("dialog", { name, exact: true });
}

test("bus.table-column-filters", { tag: "@Bus/Web" }, async ({
  page,
  isolatedWorker,
  preferenceFlow,
}) => {
  await preferenceFlow.run(async () => {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.clock.setFixedTime(new Date("2026-04-22T03:00:00Z"));
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
        ]);
      await page.goto("/catalog/bus");
      const routes = page.getByTestId("bus-route-section");
      await expect(routes).toHaveCount(2);
      await expect(
        page.getByRole("button", { name: "Apply filters", exact: true }),
      ).toHaveCount(1);
      expect(
        await isolatedWorker.database.owner.busUserPreference.findMany(),
      ).toEqual([]);

      await page.getByRole("button", { name: "Routes", exact: true }).click();
      const routePicker = page.getByRole("dialog", {
        name: "Routes",
        exact: true,
      });
      await routePicker.getByRole("checkbox", { name: /北区/ }).check();
      await routePicker.getByRole("checkbox", { name: /^东区.*高新$/ }).check();
      await expect(routes).toHaveCount(2);
      await page.keyboard.press("Escape");
      const north = await stationFilter(page, "北区");
      await north.locator("select").selectOption("gte");
      await north.getByLabel("北区 · Arrive at", { exact: true }).fill("19:00");
      await expect(page.locator("table")).toContainText("12:50");
      await expect(
        routePicker.getByRole("button", { name: "Apply filters", exact: true }),
      ).toHaveCount(0);
      await apply(page);
      await expect(routes).toHaveCount(1);
      await expect(routes).toContainText("21:15");
      await expect(routes).toContainText("~21:20");
      await expect(routes).not.toContainText("18:40");
      if (width === 390)
        await expect(page.getByTestId("bus-compact-summary")).toContainText(
          "21:15",
        );

      const northAgain = await stationFilter(page, "北区");
      await northAgain.getByLabel("北区 · Arrive at", { exact: true }).fill("");
      await northAgain
        .locator('[data-filter-field="stop3"]')
        .getByRole("checkbox", { name: "No", exact: true })
        .check();
      await apply(page);
      await expect(routes).toHaveCount(1);
      await expect(routes).toContainText("高新");
      await expect(routes).toContainText("12:50");

      const east = await stationFilter(page, "东区");
      await east.locator("select").selectOption("gt");
      await east.getByLabel("东区 · Arrive at", { exact: true }).fill("23:59");
      await apply(page);
      await expect(routes).toHaveCount(0);
      await expect(
        page
          .locator('[data-slot="collection-header"]')
          .getByRole("button", { name: "Stops", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Clear", exact: true }).click();
      await expect(routes).toHaveCount(0);
      await apply(page);
      await expect(routes).toHaveCount(2);
      await expectNoPageHorizontalOverflow(page);
      expect(
        await isolatedWorker.database.owner.busUserPreference.findMany(),
      ).toEqual([]);
    }
  }, "consume");
});
