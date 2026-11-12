import { expect, type Locator } from "@playwright/test";

/** Numeric indicators remain siblings of links, with the original scope accessible. */
export function navigationCount(navigation: Locator, href: string): Locator {
  return navigation
    .locator(`a[data-slot="sidebar-menu-button"][href="${href}"]`)
    .locator("xpath=ancestor::*[@data-slot='sidebar-menu-item'][1]")
    .locator("[data-shell-count-value]");
}

export async function expectNavigationCount(
  navigation: Locator,
  href: string,
  count: number,
  unit: string | RegExp,
): Promise<void> {
  await expect(
    navigation.locator(`a[data-slot="sidebar-menu-button"][href="${href}"]`),
  ).toHaveCount(1);
  const row = navigation
    .locator(`a[data-slot="sidebar-menu-button"][href="${href}"]`)
    .locator("xpath=ancestor::*[@data-slot='sidebar-menu-item'][1]");
  await expect(row.locator('[data-slot="sidebar-menu-badge"]')).toHaveCount(
    count > 0 ? 1 : 0,
  );
  const summary = navigationCount(navigation, href);
  if (count === 0) {
    await expect(summary).toHaveCount(0);
    return;
  }
  await expect(summary).toHaveCount(1);
  await expect(summary).toBeVisible();
  await expect(summary).toHaveAttribute(
    "data-shell-count-value",
    String(count),
  );
  await expect(summary).toHaveText(String(count));
  await expect(summary).toHaveRole("img");
  const escaped =
    typeof unit === "string"
      ? unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      : unit.source;
  await expect(summary).toHaveAccessibleName(
    new RegExp(`${count} (?:${escaped})`),
  );
}
