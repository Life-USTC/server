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

/** Expand the Schedule group (Overview / Calendar / Homework / …). */
export async function expandScheduleSidebarGroup(page: Page): Promise<void> {
  await expandSidebarGroup(page, /^(日程|Schedule)$/i);
}

/** Expand the Subscriptions group (section subscriptions + activity alerts). */
export async function expandSubscriptionsSidebarGroup(
  page: Page,
): Promise<void> {
  await expandSidebarGroup(page, /^(订阅|Subscriptions)$/i);
}

/** @deprecated Prefer expandScheduleSidebarGroup — Workspace group was removed. */
export async function expandWorkspaceSidebarGroup(page: Page): Promise<void> {
  await expandScheduleSidebarGroup(page);
}

export function sidebarNavigationLink(page: Page, name: RegExp): Locator {
  return appSidebar(page).getByRole("link", { name });
}
