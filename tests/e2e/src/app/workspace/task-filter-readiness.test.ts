import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../utils/auth";
import { waitForUiSettled } from "../../../utils/page-ready";
import { ensureSeedSectionSubscription } from "../../../utils/subscriptions";

test("ui.workspace-filters-and-empty-states-2", async ({ page }) => {
  for (const tab of ["homeworks", "todos", "exams"] as const) {
    await signInAsDebugUser(page, `/workspace/${tab}`);
    if (tab !== "todos") await ensureSeedSectionSubscription(page);

    let releaseScripts = () => {};
    const scriptsReady = new Promise<void>((resolve) => {
      releaseScripts = resolve;
    });
    await page.route("**/_app/immutable/**/*.js", async (route) => {
      await scriptsReady;
      await route.continue();
    });
    try {
      await page.goto(`/workspace/${tab}`, { waitUntil: "commit" });
      const group = page
        .locator('[data-slot="toggle-group"]')
        .filter({ has: page.locator('[data-value="incomplete"]') });
      const options = group.getByRole("radio");
      await expect(options).toHaveCount(3);
      for (const option of await options.all()) {
        await expect(option).toBeVisible();
        await expect(option).toBeDisabled();
      }

      releaseScripts();
      await waitForUiSettled(page);
      await page.context().setOffline(true);
      for (const value of ["all", "completed", "incomplete"]) {
        const option = group.locator(`[data-value="${value}"]`);
        await expect(option).toBeEnabled();
        await option.click();
        await expect(group.locator('[aria-checked="true"]')).toHaveAttribute(
          "data-value",
          value,
        );
      }
    } finally {
      releaseScripts();
      await page.context().setOffline(false);
      await page.unrouteAll({ behavior: "wait" });
    }
  }
});
