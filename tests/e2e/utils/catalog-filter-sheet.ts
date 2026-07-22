import { expect, type Page } from "@playwright/test";
import { expectNoPageHorizontalOverflow } from "./page-ready";

export async function openCatalogFilterSheet(page: Page) {
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible()) return dialog;

  const filterButton = page.getByRole("button", { name: /筛选|Filter/i });
  await expect(filterButton).toBeVisible();
  await filterButton.click();

  await expect(dialog).toBeVisible();
  return dialog;
}

export async function expectCatalogFilterSheet(page: Page, labels: RegExp[]) {
  await expectNoPageHorizontalOverflow(page);
  await expect(page.getByTestId("catalog-filter-sidebar")).toHaveCount(0);
  const toolbar = page.getByTestId("catalog-mobile-filters");
  await expect(toolbar).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#main-content form form")).toHaveCount(0);

  const searchbox = page.getByRole("searchbox");
  const searchButton = page.getByRole("button", { name: /^(搜索|Search)$/ });
  await expect(searchbox).toBeVisible();
  await expect(searchButton).toBeVisible();

  const dialog = await openCatalogFilterSheet(page);
  for (const label of labels) {
    await expect(dialog.getByLabel(label)).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  const activeFilterControls = page
    .getByTestId("catalog-active-filters")
    .locator("a, button");
  for (
    let index = 0;
    index < (await activeFilterControls.count());
    index += 1
  ) {
    await expect(activeFilterControls.nth(index)).toBeVisible();
  }
}
