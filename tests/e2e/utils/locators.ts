import { expect, type Locator, type Page } from "@playwright/test";

export function visibleText(page: Page, text: string | RegExp): Locator {
  return page.getByText(text).filter({ visible: true }).first();
}

export function appSidebar(page: Page): Locator {
  return page.getByTestId("app-sidebar");
}

/** Workspace destinations are visible together in the root sidebar. */
export async function expandDaySidebarGroup(page: Page): Promise<void> {
  const navigation = await openShellNavigation(page);
  await expect(navigation).toHaveAttribute(
    "data-shell-navigation-view",
    "root",
  );
  for (const path of [
    "/workspace/homeworks",
    "/workspace/todos",
    "/workspace/exams",
  ])
    await expect(navigation.locator(`a[href="${path}"]`)).toBeVisible();
}

export function sidebarNavigationLink(page: Page, name: RegExp): Locator {
  return appSidebar(page).getByRole("link", { name });
}

/** Opens the same page navigation on desktop and in the mobile drawer. */
export async function openShellNavigation(page: Page): Promise<Locator> {
  await page.waitForFunction(
    () => document.documentElement.dataset.lifeUstcHydrated === "true",
  );
  const mobile = (page.viewportSize()?.width ?? 1280) < 768;
  const navigation = page.locator(
    `nav[data-shell-navigation="${mobile ? "mobile" : "desktop"}"]`,
  );
  if (mobile && !(await navigation.isVisible()))
    await page
      .locator('[data-shell-topbar] [data-slot="sidebar-trigger"]')
      .click();
  if (
    !mobile &&
    (await page
      .locator('[data-slot="sidebar"][data-state="collapsed"]')
      .isVisible())
  )
    await page.locator('[data-slot="sidebar-rail"]').click();
  return navigation;
}

export async function selectDetailTab(page: Page, tab: string): Promise<void> {
  if (new URL(page.url()).pathname.startsWith("/catalog/sections/")) {
    if (["calendar", "exams"].includes(tab)) tab = "schedule";
    if (["overview", "comments", "teachers"].includes(tab))
      tab = "introduction";
  }
  const navigation = await openShellNavigation(page);
  await navigation.locator(`a[data-detail-page="${tab}"]`).click();
  await expect(page.locator("[data-detail-tab]:visible")).toHaveAttribute(
    "data-detail-tab",
    tab,
  );
}
