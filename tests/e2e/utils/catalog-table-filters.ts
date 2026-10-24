import { expect, type Locator, type Page } from "@playwright/test";
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

export async function setCatalogFilterValue(
  dialog: Locator,
  name: string,
  value: string,
) {
  const field = dialog.locator(`[data-filter-field="${name}"]`);
  await expect(field).toBeVisible();
  if (await field.getByRole("checkbox").count()) {
    const selected = value.split(",").filter(Boolean);
    for (const checkbox of await field.getByRole("checkbox").all()) {
      const id = await checkbox.getAttribute("id");
      await checkbox.setChecked(
        selected.some((item) => id?.endsWith(`-${item}`)),
      );
    }
  } else {
    await field.locator("input").first().fill(value);
  }
}

export async function expectCatalogFilterValue(
  dialog: Locator,
  name: string,
  value: string,
) {
  const field = dialog.locator(`[data-filter-field="${name}"]`);
  if (await field.getByRole("checkbox").count()) {
    const selected = value.split(",").filter(Boolean);
    for (const checkbox of await field.getByRole("checkbox").all()) {
      const id = await checkbox.getAttribute("id");
      await expect(checkbox).toHaveAttribute(
        "aria-checked",
        String(selected.some((item) => id?.endsWith(`-${item}`))),
      );
    }
  } else {
    await expect(field.locator("input").first()).toHaveValue(value);
  }
}

export async function applyCatalogFilters(page: Page) {
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible()) {
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
  await page
    .getByRole("button", { name: /^(应用筛选|Apply filters)$/i })
    .click();
}

export async function expectCatalogTableFilters(page: Page, labels: RegExp[]) {
  await expectNoPageHorizontalOverflow(page);
  await expect(page.locator("#main-content form form")).toHaveCount(0);
  const searchbox = page.getByRole("searchbox");
  await expect(searchbox).toBeVisible();
  expect(
    await searchbox.evaluate((input) =>
      Boolean(input.closest('[data-slot="table-filter-toolbar"]')),
    ),
  ).toBe(true);
  for (const label of labels) {
    const dialog = await openCatalogColumnFilter(page, label);
    await expect(dialog.locator("[data-filter-field]").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
  const activeFilters = page
    .locator('[data-slot="active-filters"]:visible')
    .locator("a, button");
  for (const control of await activeFilters.all())
    await expect(control).toBeVisible();
}
