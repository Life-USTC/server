import { expect } from "@playwright/test";
import { test } from "../../../utils/navigation-policy-fixture";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

test("ui.workspace-page-identity-4", async ({
  page,
  isolatedWorker,
  navigationRun,
}) => {
  await navigationRun(async () => {
    const actor = await isolatedWorker.createActor();
    await page.context().addCookies([actor.cookie]);
    for (const locale of ["zh-cn", "en-us"] as const) {
      const cn = locale === "zh-cn";
      await page.setViewportSize({ width: cn ? 1280 : 390, height: 844 });
      const preference = await page.request.post("/api/account/preferences", {
        data: { locale },
      });
      expect(preference.status()).toBe(200);
      await preference.body();
      expect(
        (await page.context().cookies(isolatedWorker.origin)).find(
          (cookie) => cookie.name === "NEXT_LOCALE",
        )?.value,
      ).toBe(locale);
      for (const [tab, route, name] of [
        [null, "overview", cn ? "总览" : "Overview"],
        ["calendar", "calendar", cn ? "日历" : "Calendar"],
        ["homeworks", "homeworks", cn ? "作业" : "Homework"],
        ["todos", "todos", cn ? "待办" : "Todos"],
        ["exams", "exams", cn ? "考试" : "Exams"],
        ["unknown", "overview", cn ? "总览" : "Overview"],
      ] as const) {
        const start = tab === null ? "/workspace" : `/workspace?tab=${tab}`;
        const redirect = await page.request.get(start, { maxRedirects: 0 });
        expect(redirect.status()).toBe(308);
        await redirect.body();
        expect(redirect.headers().location).toBe(`/workspace/${route}`);
        await gotoAndWaitForReady(page, start);
        await expect(page).toHaveURL(new RegExp(`/workspace/${route}$`));
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
        await expect(page.getByRole("main")).toHaveAccessibleName(name);
        await expect(page).toHaveTitle(`${name} - Life@USTC`);
      }
      // A stale selector on a semantic route must not change that route's identity.
      await gotoAndWaitForReady(page, "/workspace/todos?tab=calendar");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        cn ? "待办" : "Todos",
      );
      await expect(page.getByRole("main")).toHaveAccessibleName(
        cn ? "待办" : "Todos",
      );
      await expect(page).toHaveTitle(`${cn ? "待办" : "Todos"} - Life@USTC`);
    }
  });
});

test("ui.settings-navigation-7", async ({
  page,
  isolatedWorker,
  navigationRun,
}) => {
  await navigationRun(async () => {
    const actor = await isolatedWorker.createActor();
    await page.context().addCookies([actor.cookie]);
    for (const locale of ["zh-cn", "en-us"] as const) {
      const cn = locale === "zh-cn";
      const deleteLabel = cn ? "删除账户" : "Delete Account";
      await page.setViewportSize({ width: cn ? 1280 : 390, height: 844 });
      const preference = await page.request.post("/api/account/preferences", {
        data: { locale },
      });
      expect(preference.status()).toBe(200);
      await preference.body();
      expect(
        (await page.context().cookies(isolatedWorker.origin)).find(
          (cookie) => cookie.name === "NEXT_LOCALE",
        )?.value,
      ).toBe(locale);
      for (const route of [
        "profile",
        "preferences",
        "accounts",
        "security",
        "authorizations",
        "danger",
      ]) {
        await gotoAndWaitForReady(page, `/account/settings/${route}`);
        const danger = page.locator("[data-settings-danger-region]");
        if (route === "danger") {
          await expect(danger).toBeVisible();
          await expect(
            danger.getByRole("button", { name: deleteLabel, exact: true }),
          ).toBeVisible();
          await expect(
            page.getByRole("button", { name: deleteLabel, exact: true }),
          ).toHaveCount(1);
          await expect(
            page.locator(
              'a[href="/account/settings/danger"][aria-current="page"]',
            ),
          ).toHaveCount(1);
        } else {
          await expect(danger).toHaveCount(0);
          await expect(
            page.getByRole("button", { name: deleteLabel, exact: true }),
          ).toHaveCount(0);
          await expect(
            page.locator('form[action="?/deleteAccount"]'),
          ).toHaveCount(0);
        }
      }
    }
  });
});
