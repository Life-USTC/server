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
