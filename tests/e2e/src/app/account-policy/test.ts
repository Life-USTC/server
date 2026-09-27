import { expect, type Page, test } from "@playwright/test";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

async function accountFixture(page: Page) {
  const username = `policy${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const user = await withE2ePrisma((db) =>
    db.user.create({
      data: {
        username,
        email: `${username}@example.test`,
        emailVerified: true,
        name: `Private ${username}`,
      },
    }),
  );
  const cookie = await createSignedSessionCookie(user.id);
  await page.context().addCookies([cookie]);
  return {
    ...user,
    cookie,
    async cleanup() {
      const current = await withE2ePrisma((db) =>
        db.user.findUnique({
          where: { id: user.id },
          select: { username: true },
        }),
      );
      if (current && current.username !== username) {
        // The Worker audit queue must persist the profile event before deleting
        // its fixture actor, otherwise cleanup leaves a foreign-key retry.
        await expect
          .poll(
            () =>
              withE2ePrisma((db) =>
                db.auditLog.count({
                  where: { userId: user.id, action: "account_profile_update" },
                }),
              ),
            { timeout: 15_000 },
          )
          .toBeGreaterThan(0);
      }
      await withE2ePrisma(async (db) => {
        await db.auditLog.deleteMany({
          where: {
            OR: [
              { userId: user.id },
              { subjectUserId: user.id },
              { targetId: user.id },
            ],
          },
        });
        await db.user.deleteMany({ where: { id: user.id } });
      });
    },
  };
}

async function openDeletion(page: Page) {
  await gotoAndWaitForReady(page, "/account/settings/danger");
  await page
    .locator("[data-settings-danger-region]")
    .getByRole("button", { name: /删除|Delete/i })
    .click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  return {
    dialog,
    input: dialog.getByPlaceholder("DELETE"),
    confirm: dialog.getByRole("button", { name: /删除|Delete/i }),
  };
}
async function deleteAccount(page: Page) {
  const { input, confirm } = await openDeletion(page);
  await input.fill("DELETE");
  await confirm.click();
  await expect(page).toHaveURL(/\/$/);
}
async function renameAccount(page: Page, newUsername: string) {
  await gotoAndWaitForReady(page, "/account/settings/profile");
  await page.locator("input#username").fill(newUsername);
  await page.getByRole("button", { name: /保存|Save/i }).click();
  await expect(
    page
      .locator("[data-sonner-toast]")
      .filter({ hasText: /成功|Success|updated successfully/i }),
  ).toBeVisible();
}

test("cases.account.account-deletion-1", async ({ page }) => {
  const user = await accountFixture(page);
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("deleteAccount"))
      posts.push(request.url());
  });
  try {
    const { input, confirm, dialog } = await openDeletion(page);
    for (const value of ["", "DEL", "delete", " DELETE", "DELETE "]) {
      await input.fill(value);
      await expect(confirm).toBeDisabled();
      await input.press("Enter");
      await expect(dialog).toBeVisible();
      expect(posts).toEqual([]);
    }
    await input.fill("DELETE");
    await expect(confirm).toBeEnabled();
    await dialog.getByRole("button", { name: /取消|Cancel/i }).click();
    await expect(dialog).toBeHidden();
    expect(posts).toEqual([]);
    expect(
      await withE2ePrisma((db) => db.user.count({ where: { id: user.id } })),
    ).toBe(1);
  } finally {
    await user.cleanup();
  }
});

test("cases.account.account-deletion-2", async ({ page }) => {
  const user = await accountFixture(page);
  try {
    await deleteAccount(page);
    await expect(
      page
        .locator("[data-shell-topbar]")
        .getByRole("link", { name: /^(登录|Sign in)$/i }),
    ).toBeVisible();
    await expect(page.locator("#app-user-menu")).toHaveCount(0);
    const session = await page.request.get("/api/auth/get-session");
    expect(await session.json()).toBeNull();
    expect(
      await withE2ePrisma((db) => db.user.count({ where: { id: user.id } })),
    ).toBe(0);
  } finally {
    await user.cleanup();
  }
});

test("cases.account.deleted-session-revocation", async ({
  page,
  playwright,
  baseURL,
}) => {
  const user = await accountFixture(page);
  const secondCookie = await createSignedSessionCookie(user.id);
  const replay = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { cookie: `${secondCookie.name}=${secondCookie.value}` },
  });
  try {
    expect(
      (await (await replay.get("/api/auth/get-session")).json()).user.id,
    ).toBe(user.id);
    await deleteAccount(page);
    expect(
      await withE2ePrisma((db) =>
        db.session.count({ where: { userId: user.id } }),
      ),
    ).toBe(0);
    expect(await (await replay.get("/api/auth/get-session")).json()).toBeNull();
    expect((await replay.get("/api/workspace/todos")).status()).toBe(401);
    const workspace = await replay.get("/workspace/todos", { maxRedirects: 0 });
    expect(workspace.status()).toBe(303);
    expect(workspace.headers().location).toContain("/account/sign-in");
  } finally {
    await replay.dispose();
    await user.cleanup();
  }
});

test("cases.account.username-change-2", async ({ page }) => {
  const user = await accountFixture(page);
  const newUsername = `${user.username?.slice(0, -3)}new`;
  try {
    expect(
      (
        await page.request.get(`/api/community/users/${user.username}`)
      ).status(),
    ).toBe(200);
    await renameAccount(page, newUsername);
    expect(
      await withE2ePrisma((db) =>
        db.user.findUnique({
          where: { id: user.id },
          select: { username: true },
        }),
      ),
    ).toEqual({ username: newUsername });
    expect(
      (
        await page.request.get(`/api/community/users/${user.username}`, {
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(404);
    const oldPage = await page.request.get(
      `/community/users/${user.username}`,
      { maxRedirects: 0 },
    );
    expect(oldPage.status()).toBe(404);
    const current = await page.request.get(
      `/api/community/users/${newUsername}`,
    );
    expect(current.status()).toBe(200);
    expect((await current.json()).user).toMatchObject({
      id: user.id,
      username: newUsername,
    });
  } finally {
    await user.cleanup();
  }
});
