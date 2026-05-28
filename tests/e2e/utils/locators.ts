import type { Locator, Page } from "@playwright/test";

export function visibleText(page: Page, text: string | RegExp): Locator {
  return page.getByText(text).filter({ visible: true }).first();
}

export function visible(locator: Locator): Locator {
  return locator.filter({ visible: true }).first();
}
