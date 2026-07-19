import { expect, type Page } from "@playwright/test";
import { expectNoPageHorizontalOverflow } from "./page-ready";

export async function expectCatalogInlineFilters(page: Page, labels: RegExp[]) {
  await expectNoPageHorizontalOverflow(page);
  await expect(page.getByTestId("catalog-filter-sidebar")).toHaveCount(0);
  const toolbar = page.getByTestId("catalog-mobile-filters");
  const inlineFilters = page.getByTestId("catalog-inline-filters");
  await expect(toolbar).toBeVisible();
  await expect(inlineFilters).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /筛选|Filter/i })).toHaveCount(
    0,
  );
  await expect(page.locator("#main-content form form")).toHaveCount(0);

  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Viewport is unavailable");

  const searchbox = page.getByRole("searchbox");
  const searchButton = page.getByRole("button", { name: /^(搜索|Search)$/ });
  const inputGroup = searchbox.locator(
    'xpath=ancestor::*[@data-slot="input-group"]',
  );
  const inputBox = await inputGroup.boundingBox();
  const searchButtonBox = await searchButton.boundingBox();
  expect(inputBox).not.toBeNull();
  expect(searchButtonBox).not.toBeNull();
  expect(inputBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(searchButtonBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(searchButtonBox?.y ?? 0).toBe(inputBox?.y ?? 0);

  let firstControlBox = null as Awaited<
    ReturnType<typeof inlineFilters.boundingBox>
  >;
  for (const label of labels) {
    const control = inlineFilters.getByLabel(label);
    await expect(control).toHaveCount(1);
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
      viewport.width,
    );
    firstControlBox ??= box;
  }

  if (viewport.width >= 1280) {
    expect(firstControlBox).not.toBeNull();
    expect(
      Math.abs((inputBox?.y ?? 0) - (firstControlBox?.y ?? 0)),
    ).toBeLessThan(1);
  }

  if (viewport.width < 640) {
    const activeFilterControls = page
      .getByTestId("catalog-active-filters")
      .locator("a, button");
    for (
      let index = 0;
      index < (await activeFilterControls.count());
      index += 1
    ) {
      const box = await activeFilterControls.nth(index).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  }
}
