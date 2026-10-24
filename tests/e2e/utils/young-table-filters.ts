import { expect, type Page } from "@playwright/test";

export async function openYoungTableField(page: Page, name: string) {
  await page.keyboard.press("Escape");
  const labels: Record<string, RegExp> = {
    search: new URL(page.url()).pathname.endsWith("/organizers")
      ? /^(主办方|Organizer)$/i
      : /^(活动|Event)$/i,
    module: /^(二课堂模块|Module)$/i,
    activityLevel: /^(活动级别|Level)$/i,
    organizerId: /^(主办方|Organizer)$/i,
    category: /^(类别|Category)$/i,
    status: /^(状态|Status)$/i,
    timeBasis: /^(日历依据|Calendar dates)$/i,
    active: /^(活动范围|Activity scope)$/i,
    capacity: /^(名额|Capacity)$/i,
    appliedCount: /^(名额|Capacity)$/i,
  };
  const trigger = page
    .locator('[data-slot="table-column-header"]:visible')
    .getByRole("button", { name: labels[name] });
  await trigger.click();
  const field = page.locator(`[data-filter-field="${name}"]:visible`);
  await expect(field).toBeVisible();
  return field;
}

export async function fillYoungTableSearch(page: Page, value: string) {
  const field = await openYoungTableField(page, "search");
  await field.locator("input").fill(value);
  await page.keyboard.press("Escape");
}

export async function setYoungTableChoices(
  page: Page,
  name: string,
  values: string[],
) {
  const field = await openYoungTableField(page, name);
  await field.getByRole("button").first().click();
  for (const value of values)
    await field
      .locator(
        `[role="checkbox"][id$=${JSON.stringify(`-${name === "category" ? encodeURIComponent(value) : value}`)}]`,
      )
      .check();
  await page.keyboard.press("Escape");
}

export async function applyYoungTableFilters(page: Page) {
  await page.keyboard.press("Escape");
  await page
    .locator('[data-slot="table-filter-apply"]')
    .getByRole("button", { name: /^(应用筛选|Apply filters)$/i })
    .click();
}
