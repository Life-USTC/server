import { expect } from "@playwright/test";
import { createSignedDemoCookie } from "../../../../shared/demo-token";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
const publicPaths = [
  "/catalog/sections",
  "/catalog/courses",
  "/catalog/teachers",
  "/catalog/bus",
  "/catalog/weather",
  "/news",
  "/catalog/links",
  "/catalog/rooms",
];
for (const [locale, width] of [
  ["en-us", 1280],
  ["zh-cn", 390],
] as const) {
  test(`campus.public-directory sealed projection ${locale} ${width}`, {
    tag: "@Site/Web",
  }, async ({ page, isolatedWorker, preferenceFlow }) => {
    const actor = await preferenceFlow.prepare(async () => {
      const actor = await isolatedWorker.createActor({ isAdmin: true });
      await isolatedWorker.database.owner.user.update({
        where: { id: actor.id },
        data: {
          name: "Private campus administrator",
          username: "campus-administrator",
        },
      });
      return actor;
    });
    await preferenceFlow.run(async () => {
      await page.setViewportSize({ width, height: 844 });
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
        ]);
      const guest = await page.request.get("/campus/__data.json");
      expect(guest.status()).toBe(200);
      expect(guest.headers()["x-life-public-navigation"]).toBe("1");
      const guestText = await guest.text();
      expect(guestText).not.toContain(actor.id);
      expect(guestText).not.toContain("Private campus administrator");
      await page.context().addCookies([actor.cookie]);
      const ordinary = await page.request.get("/campus/__data.json");
      expect(ordinary.status()).toBe(200);
      expect(await ordinary.text()).toBe(guestText);
      await gotoAndWaitForReady(page, "/campus");
      await expect(
        page.getByRole("heading", {
          name: locale === "en-us" ? "Campus" : "校园",
          exact: true,
          level: 1,
        }),
      ).toBeVisible();
      const directory = page.locator("[data-feature-directory]");
      const expectPublicExtras = async () =>
        expect(
          await directory
            .locator('[data-feature-entry] a:not([data-slot="item"])')
            .evaluateAll((nodes) =>
              nodes.map((node) => node.getAttribute("href")),
            ),
        ).toEqual(["/catalog/bus/map", "/news/sources"]);
      expect(
        await directory
          .locator('[data-feature-entry] a[data-slot="item"]')
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("href")),
          ),
      ).toEqual(publicPaths);
      await expectPublicExtras();
      await expect(
        directory.locator(
          'a[href^="/workspace"],a[href^="/account"],a[href^="/admin"]',
        ),
      ).toHaveCount(0);
      await expect(page.locator("#app-user-menu:visible")).toHaveCount(1);
      await page.locator("#app-user-menu").getByRole("button").click();
      await expect(
        page.getByRole("menu").locator('a[href="/workspace/uploads"]'),
      ).toBeVisible();
      await expect(
        page.getByRole("menu").locator('a[href="/admin/users"]'),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(
        page.locator("#app-user-menu").getByRole("button"),
      ).toBeFocused();
      await page.context().clearCookies();
      await page.context().addCookies([
        {
          ...(await createSignedDemoCookie({
            issuedAt: Math.floor(Date.now() / 1000),
          })),
          url: isolatedWorker.origin,
        },
        { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
      ]);
      await gotoAndWaitForReady(page, "/campus");
      await expect(page.getByTestId("demo-notice")).toBeVisible();
      await expect(page.locator("#app-user-menu")).toHaveCount(0);
      await expect(page.locator("#demo-navigation-menu:visible")).toHaveCount(
        1,
      );
      expect(
        await directory
          .locator('[data-feature-entry] a[data-slot="item"]')
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("href")),
          ),
      ).toEqual(publicPaths);
      await expectPublicExtras();
      await expect(
        directory.locator(
          'a[href^="/workspace"],a[href^="/account"],a[href^="/admin"]',
        ),
      ).toHaveCount(0);
      await directory.locator('a[href="/catalog/courses"]').click();
      await expect(page).toHaveURL(/\/catalog\/courses$/);
      await expect(page.getByTestId("demo-notice")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  });
}
