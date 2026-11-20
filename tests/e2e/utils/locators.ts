import { expect, type Locator, type Page } from "@playwright/test";

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
  const sidebar = appSidebar(page);
  const group = sidebar.locator('[data-slot="sidebar-group"]').filter({
    has: page
      .locator('[data-slot="sidebar-group-label"]')
      .filter({ hasText: name }),
  });
  await expect(group).toHaveCount(1);
  const globalExpansion = group.locator("button[data-shell-expand-sidebar]");
  if (await globalExpansion.count()) await globalExpansion.click();
  await expect(
    group.locator('[data-slot="sidebar-group-label"]'),
  ).not.toHaveAttribute("aria-expanded");
  await expect(
    group.locator('[data-slot="sidebar-group-content"]'),
  ).toBeVisible();
  await expect(group.locator('[data-slot="sidebar-menu-action"]')).toHaveCount(
    0,
  );
}

/** Verify the real current Workspace directory; never switch navigation levels implicitly. */
export async function expandDaySidebarGroup(page: Page): Promise<void> {
  await expect(page.getByTestId("workspace-sidebar")).toHaveAttribute(
    "data-shell-navigation-view",
    "workspace",
  );
  await expandSidebarGroup(page, /^(工作台|Workspace)$/i);
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
  const navigation = await openShellNavigation(page);
  await navigation.locator(`a[data-detail-page="${tab}"]`).click();
  await expect(page.locator("[data-detail-tab]:visible")).toHaveAttribute(
    "data-detail-tab",
    tab,
  );
}
