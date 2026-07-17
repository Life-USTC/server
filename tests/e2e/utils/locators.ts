import type { Locator, Page } from "@playwright/test";

export function visibleText(page: Page, text: string | RegExp): Locator {
  return page.getByText(text).filter({ visible: true }).first();
}

export function visible(locator: Locator): Locator {
  return locator.filter({ visible: true }).first();
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

export async function expandWorkspaceSidebarGroup(page: Page): Promise<void> {
  await expandSidebarGroup(page, /^(工作台|Workspace)$/i);
}

export function sidebarNavigationLink(page: Page, name: RegExp): Locator {
  return appSidebar(page).getByRole("link", { name });
}
