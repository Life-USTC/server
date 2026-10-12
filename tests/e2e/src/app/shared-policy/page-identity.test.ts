import { expect, type Page } from "@playwright/test";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { test } from "../../../utils/navigation-policy-fixture";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

async function prepare(
  page: Page,
  worker: IsolatedWorker,
  locale: "zh-cn" | "en-us",
) {
  const actor = await worker.createActor();
  await page.context().addCookies([actor.cookie]);
  await page.setViewportSize({
    width: locale === "zh-cn" ? 1280 : 390,
    height: 844,
  });
  const preference = await page.request.post("/api/account/preferences", {
    data: { locale },
  });
  expect(preference.status()).toBe(200);
  await preference.body();
  expect(
    (await page.context().cookies(worker.origin)).find(
      (cookie) => cookie.name === "NEXT_LOCALE",
    )?.value,
  ).toBe(locale);
}

for (const locale of ["zh-cn", "en-us"] as const) {
  const cn = locale === "zh-cn";
  for (const [tab, route, name] of [
    [null, "overview", cn ? "总览" : "Overview"],
    ["calendar", "calendar", cn ? "日历" : "Calendar"],
    ["homeworks", "homeworks", cn ? "作业" : "Homework"],
    ["todos", "todos", cn ? "待办" : "Todos"],
    ["exams", "exams", cn ? "考试" : "Exams"],
    ["unknown", "overview", cn ? "总览" : "Overview"],
  ] as const) {
    const start = tab === null ? "/workspace" : `/workspace?tab=${tab}`;
    test(`ui.workspace-page-identity-4: ${locale} ${start}`, {
      tag: `@${{ overview: "Overview", calendar: "Calendar", homeworks: "Homework", todos: "Todo", exams: "Exam" }[route]}/Web`,
    }, async ({ page, isolatedWorker, navigationRun }) => {
      await navigationRun(async () => {
        await prepare(page, isolatedWorker, locale);
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
      });
    });
  }

  test(`ui.workspace-page-identity-4: ${locale} ignores a stale tab on /workspace/todos`, {
    tag: "@Todo/Web",
  }, async ({ page, isolatedWorker, navigationRun }) => {
    await navigationRun(async () => {
      await prepare(page, isolatedWorker, locale);
      // A stale selector on a semantic route must not change that route's identity.
      await gotoAndWaitForReady(page, "/workspace/todos?tab=calendar");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        cn ? "待办" : "Todos",
      );
      await expect(page.getByRole("main")).toHaveAccessibleName(
        cn ? "待办" : "Todos",
      );
      await expect(page).toHaveTitle(`${cn ? "待办" : "Todos"} - Life@USTC`);
    });
  });

  for (const route of [
    "profile",
    "preferences",
    "accounts",
    "security",
    "authorizations",
    "danger",
  ]) {
    test(`ui.settings-navigation-7: ${locale} /account/settings/${route}`, {
      tag: "@Account/Web",
    }, async ({ page, isolatedWorker, navigationRun }) => {
      await navigationRun(async () => {
        await prepare(page, isolatedWorker, locale);
        const deleteLabel = cn ? "删除账户" : "Delete Account";
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
          const dangerLink = page.locator(
            'a[href="/account/settings/danger"][aria-current="page"]',
          );
          if ((await dangerLink.count()) === 0)
            await page.locator('[data-slot="sidebar-trigger"]').click();
          await expect(dangerLink).toHaveCount(1);
        } else {
          await expect(danger).toHaveCount(0);
          await expect(
            page.getByRole("button", { name: deleteLabel, exact: true }),
          ).toHaveCount(0);
          await expect(
            page.locator('form[action="?/deleteAccount"]'),
          ).toHaveCount(0);
        }
      });
    });
  }
}
