import { expect, type Page, test } from "@playwright/test";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

async function signIn(page: Page) {
  const user = await withE2ePrisma((db) =>
    db.user.create({
      data: {
        name: "Shell policy user",
        username: `shell${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        email: `shell-policy-${crypto.randomUUID()}@example.test`,
        isAdmin: true,
      },
    }),
  );
  await page.context().addCookies([await createSignedSessionCookie(user.id)]);
  expect(
    (
      await page.request.post("/api/account/preferences", {
        data: { locale: "en-us" },
      })
    ).status(),
  ).toBe(200);
  return user;
}

test("ui.shell-layout-1", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 400 });
  await gotoAndWaitForReady(page, "/terms");
  const sidebar = page
    .getByTestId("app-sidebar")
    .locator('[data-slot="sidebar-content"]');
  const main = page.locator("[data-shell-scroll-container]");
  for (const pane of [sidebar, main]) {
    expect(
      await pane.evaluate(
        (element) => element.scrollHeight - element.clientHeight,
      ),
    ).toBeGreaterThan(200);
    expect(await pane.evaluate((element) => element.scrollTop)).toBe(0);
  }
  await sidebar.hover();
  await page.mouse.wheel(0, 300);
  await expect
    .poll(() => sidebar.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(100);
  expect(await main.evaluate((element) => element.scrollTop)).toBe(0);
  const sidebarPosition = await sidebar.evaluate(
    (element) => element.scrollTop,
  );
  await main.hover();
  await page.mouse.wheel(0, 350);
  await expect
    .poll(() => main.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(100);
  expect(await sidebar.evaluate((element) => element.scrollTop)).toBe(
    sidebarPosition,
  );
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await main.focus();
  await page.keyboard.press("Home");
  await expect
    .poll(() => main.evaluate((element) => element.scrollTop))
    .toBe(0);
  expect(await sidebar.evaluate((element) => element.scrollTop)).toBe(
    sidebarPosition,
  );
});

test("ui.shell-layout-5", async ({ page }) => {
  const user = await signIn(page);
  try {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndWaitForReady(page, "/workspace/todos");
      const topbar = page.locator("[data-shell-topbar]");
      for (const name of [/Language/, /Theme/]) {
        const control = topbar.getByRole("button", { name });
        await expect(control).toBeVisible();
        await control.focus();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("menu")).toBeVisible();
        await expect(page.getByRole("menuitemradio").first()).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(control).toBeFocused();
      }
      await expect(
        topbar.getByRole("button", { name: "Profile menu" }),
      ).toHaveCount(0);
      if (width < 768)
        await topbar.getByRole("button", { name: "Menu", exact: true }).click();
      const shell =
        width < 768
          ? page.getByRole("dialog", { name: "Sidebar", exact: true })
          : page.getByTestId("app-sidebar");
      const profile = shell
        .locator('[data-slot="sidebar-footer"]')
        .getByRole("button", { name: "Profile menu", exact: true });
      await expect(profile).toBeVisible();
      await profile.focus();
      await page.keyboard.press("Enter");
      for (const name of ["Personal page", "Settings", "Sign Out"])
        await expect(
          page.getByRole("menuitem", { name, exact: true }),
        ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(profile).toBeFocused();
    }
  } finally {
    await withE2ePrisma((db) => db.user.delete({ where: { id: user.id } }));
  }
});

test("ui.shell-layout-7", async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/catalog/courses", "/terms"]) {
      await gotoAndWaitForReady(page, path);
      const signIn = page
        .locator("[data-shell-topbar]")
        .getByRole("link", { name: /^(Sign in|登录)$/i });
      await expect(signIn).toBeVisible();
      await expect(signIn).toHaveAttribute("href", "/account/sign-in");
      await signIn.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/account\/sign-in$/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  }
});

test("ui.workspace-footer-policy-2", async ({ page }) => {
  await gotoAndWaitForReady(page, "/terms");
  await expect(
    page.getByRole("navigation", { name: /Footer navigation|页脚导航/ }),
  ).toBeVisible();
  const user = await signIn(page);
  try {
    for (const path of [
      "/workspace/overview",
      "/workspace/calendar",
      "/workspace/homeworks",
      "/workspace/todos",
      "/workspace/exams",
      "/workspace/subscriptions",
      "/account/settings/profile",
      "/account/settings/accounts",
      "/account/settings/preferences",
      "/account/settings/danger",
      "/admin/users",
      "/admin/moderation",
      "/admin/bus",
    ]) {
      await gotoAndWaitForReady(page, path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(
        page.getByRole("navigation", {
          name: "Footer navigation",
          exact: true,
        }),
      ).toHaveCount(0);
    }
    await withE2ePrisma((db) =>
      db.user.update({
        where: { id: user.id },
        data: { name: "", username: null },
      }),
    );
    await gotoAndWaitForReady(page, "/account/welcome");
    await expect(page).toHaveURL(/\/account\/welcome$/);
    await expect(
      page.getByRole("navigation", { name: "Footer navigation", exact: true }),
    ).toHaveCount(0);
  } finally {
    await withE2ePrisma((db) => db.user.delete({ where: { id: user.id } }));
  }
});
