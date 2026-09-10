import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../utils/auth";
import { DEV_SEED } from "../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { ensureSeedSectionSubscription } from "../../../utils/subscriptions";

for (const tab of ["homeworks", "todos"] as const) {
  for (const mobile of [false, true]) {
    test(`${tab} completion filter keeps one immediate selection on ${mobile ? "mobile" : "desktop"}`, async ({
      page,
    }) => {
      await page.setViewportSize(
        mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      );
      await signInAsDebugUser(page, `/workspace/${tab}`);
      if (tab === "homeworks") await ensureSeedSectionSubscription(page);
      await gotoAndWaitForReady(page, `/workspace/${tab}`);
      const group = page
        .locator('[data-slot="toggle-group"]')
        .filter({ has: page.locator('[data-value="incomplete"]') });
      const options = group.getByRole("radio");
      const completedTitle =
        tab === "homeworks"
          ? DEV_SEED.homeworks.completedTitle
          : DEV_SEED.todos.completedTitle;
      const incompleteTitle =
        tab === "homeworks"
          ? DEV_SEED.homeworks.overdueTitle
          : DEV_SEED.todos.overdueTitle;

      for (const selected of ["all", "completed", "incomplete", "all"]) {
        const option = group.locator(`[data-value="${selected}"]`);
        for (const action of ["click", "click", "space"] as const) {
          if (action === "space") await option.press("Space");
          else await option.click();
          await page.mouse.move(0, 0);
          const states = await options.evaluateAll((elements) =>
            elements.map((element) => ({
              value: element.getAttribute("data-value"),
              checked: element.getAttribute("aria-checked"),
              state: element.getAttribute("data-state"),
              background: getComputedStyle(element).backgroundColor,
            })),
          );
          expect(
            states
              .filter((state) => state.checked === "true")
              .map((state) => state.value),
          ).toEqual([selected]);
          expect(
            states
              .filter((state) => state.state === "on")
              .map((state) => state.value),
          ).toEqual([selected]);
          expect(
            states
              .filter((state) => state.background !== "rgba(0, 0, 0, 0)")
              .map((state) => state.value),
          ).toEqual([selected]);
          await expect(
            page
              .getByRole("button", { name: completedTitle, exact: true })
              .first(),
          ).toBeVisible({ visible: selected !== "incomplete" });
          await expect(
            page
              .getByRole("button", { name: incompleteTitle, exact: true })
              .first(),
          ).toBeVisible({ visible: selected !== "completed" });
        }
      }
    });
  }
}
