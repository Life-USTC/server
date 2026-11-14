import { expect } from "@playwright/test";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { busTest as test } from "../../../utils/personal-preferences-fixture";

import { expectRenderedUiQuality } from "../../../utils/ui-quality";

test.use({ workerBindings: { E2E_DEBUG_AUTH: "0" } });

for (const [locale, width] of [
  ["en-us", 1280],
  ["zh-cn", 390],
] as const) {
  test(`four primary matched navigation after ${locale} ${width}`, {
    tag: "@Site/Web",
  }, async ({ page, isolatedWorker, preferenceFlow }) => {
    const actor = await preferenceFlow.prepare(async () => {
      const actor = await isolatedWorker.createActor({ isAdmin: true });
      await isolatedWorker.database.owner.user.update({
        where: { id: actor.id },
        data: {
          name: "Navigation reader",
          username: "nav-review-admin",
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
      });
      await isolatedWorker.database.owner.todo.create({
        data: {
          userId: actor.id,
          title: "Navigation review task",
          dueAt: new Date("2026-11-12T05:00:00Z"),
        },
      });
      return actor;
    });
    await preferenceFlow.run(async () => {
      await page.setViewportSize({ width, height: 844 });
      await page
        .context()
        .addCookies([
          actor.cookie,
          { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
        ]);
      await page.addInitScript(() =>
        localStorage.setItem(
          "life-ustc.sidebar.v1",
          JSON.stringify({ open: true, groups: {}, submenus: {} }),
        ),
      );
      const nav = page.locator(
        `[data-shell-navigation="${width === 390 ? "mobile" : "desktop"}"]`,
      );
      const menuName = locale === "en-us" ? "Menu" : "菜单";
      const open = async () => {
        if (width === 390)
          await page
            .getByRole("button", {
              name: menuName,
              exact: true,
            })
            .click();
        await expect(nav).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await waitForUiSettled(page);
      };
      const capture = async (state: string) => {
        await waitForUiSettled(page);
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all(
            document
              .getAnimations()
              .filter(
                (animation) =>
                  animation.effect?.getTiming().iterations !== Infinity,
              )
              .map((animation) => animation.finished.catch(() => {})),
          );
        });
        return page.screenshot({
          path: `/tmp/life-sidebar-adjacent-after-${state}-${locale}-${width}.png`,
        });
      };
      await gotoAndWaitForReady(
        page,
        "/?snapshotAt=2026-11-12T04%3A00%3A00.000Z",
      );
      await expect(page.locator("[data-overview-sections]")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      await open();
      await page.getByTestId("workspace-sidebar-back").click();
      await expect(nav).toHaveAttribute("data-shell-navigation-view", "root");
      expect(
        await nav
          .locator('[data-navigation-depth="0"][href]')
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("href")),
          ),
      ).toEqual([
        "/",
        "/workspace/calendar",
        "/campus",
        "/catalog/young-events",
      ]);
      await expect(nav.locator("[data-local-navigation-back]")).toHaveCount(0);
      await expect(nav.locator("#app-logo")).toHaveText("Life@USTC");
      await expect(
        nav.locator('[data-navigation-depth="1"][href="/catalog/bus"]'),
      ).toBeVisible();
      await expect(
        nav.locator('[data-navigation-depth="1"][href="/workspace/homeworks"]'),
      ).toBeVisible();
      // The root shows only its direct children, not grandchildren such as the route map.
      await expect(nav.locator('a[href="/catalog/bus/map"]')).toHaveCount(0);
      await expect(
        nav.locator('[data-slot="collapsible-trigger"]'),
      ).toHaveCount(0);
      await expectRenderedUiQuality(page);
      await capture("root");
      if (width === 1280) {
        const collapse = nav.locator('[data-slot="sidebar-trigger"]');
        await expect(collapse).toBeVisible();
        await expect(collapse).toHaveAttribute("aria-expanded", "true");
        await collapse.click();
        await expect(collapse).toHaveAttribute("aria-expanded", "false");
        await expect(
          nav.locator('[data-navigation-depth="1"]').first(),
        ).toBeHidden();
        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect(page.locator('[data-slot="sidebar-gap"]')).toHaveCSS(
          "transition-property",
          "none",
        );
        await expect(page.locator('[data-slot="sidebar-container"]')).toHaveCSS(
          "transition-property",
          "none",
        );
        await expect(nav.locator('[data-slot="sidebar-flow"]')).toHaveCSS(
          "animation-name",
          "none",
        );
        await collapse.click();
        await expect(collapse).toHaveAttribute("aria-expanded", "true");
        await expect(
          nav.locator('[data-navigation-depth="1"][href="/catalog/bus"]'),
        ).toBeVisible();
        await page.emulateMedia({ reducedMotion: "no-preference" });
      }
      await gotoAndWaitForReady(page, "/catalog/bus");
      await open();
      await expect(nav).toHaveAttribute("data-shell-navigation-view", "bus");
      expect(
        await nav
          .locator('[data-slot="sidebar-content"] a')
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("href")),
          ),
      ).toEqual(["/catalog/bus", "/catalog/bus/map"]);
      await expect(nav.locator('a[href="/catalog/bus"]')).toHaveAttribute(
        "data-navigation-depth",
        "0",
      );
      await expect(nav.locator('a[href="/catalog/bus/map"]')).toHaveAttribute(
        "data-navigation-depth",
        "1",
      );
      await expect(nav.locator('[data-navigation-depth="2"]')).toHaveCount(0);
      await expectRenderedUiQuality(page);
      await capture("bus");
      await page.getByTestId("bus-sidebar-back").click();
      await expect(nav).toHaveAttribute("data-shell-navigation-view", "campus");
      await expect(
        nav.locator('[data-navigation-depth="1"][href="/catalog/bus/map"]'),
      ).toBeVisible();
      await capture("campus");
      await gotoAndWaitForReady(page, "/catalog/weather");
      await open();
      await expect(nav).toHaveAttribute("data-shell-navigation-view", "campus");
      await expect(nav.locator('a[href="/catalog/weather"]')).toHaveAttribute(
        "aria-current",
        "page",
      );
      await gotoAndWaitForReady(page, "/workspace/calendar");
      await open();
      await expect(nav).toHaveAttribute("data-shell-navigation-view", "root");
      await expect(nav.locator("[data-local-navigation-back]")).toHaveCount(0);
      await expect(
        nav.locator('a[href="/workspace/calendar"]'),
      ).toHaveAttribute("aria-current", "page");
      await gotoAndWaitForReady(page, "/workspace/homeworks");
      await open();
      await expect(nav).toHaveAttribute(
        "data-shell-navigation-view",
        "workspace",
      );
      await expect(
        nav.locator(
          'a[href^="/admin"],a[href^="/account"],a[href="/workspace/uploads"]',
        ),
      ).toHaveCount(0);
      await expectRenderedUiQuality(page);
      await capture("workspace");
      await gotoAndWaitForReady(
        page,
        "/?snapshotAt=2026-11-12T04%3A00%3A00.000Z",
      );
      await expect(page.locator("[data-overview-sections]")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      // Account controls now live once in Topbar; keep the actual Home and account-menu state.
      await page.evaluate(() => document.fonts.ready);
      await waitForUiSettled(page);
      const account = page.locator("#app-user-menu:visible");
      await expect(account).toHaveCount(1);
      await account.getByRole("button").click();
      await expect(page.getByRole("menu")).toBeVisible();
      await expect(
        page.locator("[data-shell-topbar] #app-user-menu"),
      ).toHaveCount(1);
      await expect(
        page.locator(
          '[data-testid="app-sidebar"] #app-user-menu,footer #app-user-menu',
        ),
      ).toHaveCount(0);
      for (const href of [
        "/account/settings/preferences",
        "/workspace/uploads",
        "/admin/users",
      ])
        await expect(
          page.getByRole("menu").locator(`a[href="${href}"]`),
        ).toBeVisible();
      await expectRenderedUiQuality(page);
      await capture("avatar");
    });
  });
}
