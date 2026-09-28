import { createLocalAccountIssuer } from "@better-auth/core/db";
import { expect, type Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import type { User } from "../../../src/generated/prisma-node/client";
import type { TestPrismaClient } from "../../shared/prisma";
import { test as workerTest } from "./isolated-worker";
import { gotoAndWaitForReady, waitForUiSettled } from "./page-ready";

/** Only credential records are arranged; sessions must come from the real UI. */
export async function arrangeSignInCredential(
  db: TestPrismaClient,
  admin: boolean,
) {
  const username = admin ? "dev-admin" : "dev-user";
  const password = await hashPassword(
    admin ? "dev-admin-password" : "dev-debug-password",
  );
  return db.$transaction(async (db) => {
    const user = await db.user.create({
      data: {
        username,
        name: admin ? "校园管理员" : "Dev User",
        email: `${username}@debug.local`,
        emailVerified: true,
        isAdmin: admin,
      },
    });
    await db.account.create({
      data: {
        type: "credential",
        provider: "credential",
        issuer: createLocalAccountIssuer("credential"),
        providerAccountId: user.id,
        userId: user.id,
        password,
      },
    });
    return user;
  });
}

export const test = workerTest.extend<{ debugUser: User; adminUser: User }>({
  debugUser: async ({ isolatedWorker }, use) => {
    await use(
      await arrangeSignInCredential(isolatedWorker.database.owner, false),
    );
  },
  adminUser: async ({ isolatedWorker }, use) => {
    await use(
      await arrangeSignInCredential(isolatedWorker.database.owner, true),
    );
  },
});

export async function signInThroughDevButton(page: Page, account: User) {
  await gotoAndWaitForReady(page, "/account/sign-in?callbackUrl=%2F");
  await expect(page).toHaveURL(/\/account\/sign-in\?callbackUrl=%2F$/);
  const button = page.getByRole("button", {
    name: account.isAdmin
      ? /Admin User \(Dev\)|调试管理员（开发）/i
      : /Debug User \(Dev\)|调试用户（开发）/i,
  });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page).toHaveURL(/\/workspace\/overview$/);
  await waitForUiSettled(page);
  const response = await page.request.get(
    "/api/auth/get-session?disableCookieCache=true",
  );
  expect(response.status()).toBe(200);
  expect((await response.json()).user).toMatchObject({
    id: account.id,
    isAdmin: account.isAdmin,
  });
  await expect(page.locator("#main-content")).toBeVisible();
}
