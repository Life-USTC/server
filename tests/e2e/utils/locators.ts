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

export async function expandDashboardSidebarGroup(page: Page): Promise<void> {
  const trigger = appSidebar(page).getByRole("button", {
    name: /^(仪表盘|Dashboard)$/i,
  });
  const state = await trigger.getAttribute("data-state");
  if (state === "closed") {
    await trigger.click();
  }
}

export function sidebarDashboardLink(page: Page, name: RegExp): Locator {
  return appSidebar(page).getByRole("link", { name });
}
