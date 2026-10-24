import { expect, type Page } from "@playwright/test";
import { expectNoPageHorizontalOverflow } from "./page-ready";

export async function openCatalogColumnFilter(
  page: Page,
  label: string | RegExp,
) {
  const dialog = page.getByRole("dialog", { name: label, exact: true });
  if (await dialog.isVisible()) return dialog;
  const trigger = page
    .locator('[data-slot="table-column-header"]')
    .getByRole("button", { name: label, exact: true });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function expectCatalogTableFilters(page: Page, labels: RegExp[]) {
  await expectNoPageHorizontalOverflow(page);
  await expect(page.locator("#main-content form form")).toHaveCount(0);
  const searchbox = page.getByRole("searchbox");
  await expect(searchbox).toBeVisible();
  expect(
    await searchbox.evaluate((input) =>
      Boolean(input.closest('thead, [data-slot="collection-header"]')),
    ),
  ).toBe(true);
  for (const label of labels) {
    const dialog = await openCatalogColumnFilter(page, label);
    await expect(dialog.getByLabel(label)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
  const activeFilters = page
    .locator('[data-slot="active-filters"]:visible')
    .locator("a, button");
  for (const control of await activeFilters.all())
    await expect(control).toBeVisible();
}
