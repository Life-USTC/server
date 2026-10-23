import type { Locator, Page } from "@playwright/test";

export function visibleText(page: Page, text: string | RegExp): Locator {
  return page.getByText(text).filter({ visible: true }).first();
}

export function appSidebar(page: Page): Locator {
  return page.getByTestId("app-sidebar");
}

export async function expandSidebarGroup(
  page: Page,
  name: RegExp,
): Promise<void> {
  const trigger = appSidebar(page).getByRole("button", { name });
  const state = await trigger.getAttribute("data-state");
  if (state === "closed") {
    await trigger.click();
  }
}

/** Expand My day (Calendar / Homework / …). */
export async function expandDaySidebarGroup(page: Page): Promise<void> {
  await expandSidebarGroup(page, /^(日程|My day)$/i);
}

export function sidebarNavigationLink(page: Page, name: RegExp): Locator {
  return appSidebar(page).getByRole("link", { name });
}
