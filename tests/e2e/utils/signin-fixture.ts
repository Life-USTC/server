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
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const username = admin ? "dev-admin" : "dev-user";
  const password = await hashPassword(
    admin ? "dev-admin-password" : "dev-debug-password",
  );
  signal.throwIfAborted();
  return db.$transaction(async (db) => {
    signal.throwIfAborted();
    const user = await db.user.create({
      data: {
        username,
        name: admin ? "校园管理员" : "Dev User",
        email: `${username}@debug.local`,
        emailVerified: true,
        isAdmin: admin,
      },
    });
    signal.throwIfAborted();
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

export const test = workerTest.extend<{
  debugUser: User;
  adminUser: User;
  _signInCredentials: { create: (admin: boolean) => Promise<User> };
}>({
  _signInCredentials: async ({ isolatedWorker }, use) => {
    const abort = new AbortController();
    const pending = new Set<Promise<User>>();
    try {
      // Native teardown owns hashing before a dependent fixture starts it.
      await use({
        create: (admin) => {
          abort.signal.throwIfAborted();
          const credential = arrangeSignInCredential(
            isolatedWorker.database.owner,
            admin,
            abort.signal,
          );
          pending.add(credential);
          void credential
            .finally(() => pending.delete(credential))
            .catch(() => {});
          return credential;
        },
      });
    } finally {
      abort.abort(new Error("Sign-in credential resources disposed"));
      // Hashing cannot be cancelled, so await its continuation and any already
      // started transaction before the underlying Worker/database are disposed.
      await Promise.allSettled(pending);
    }
  },
  debugUser: async ({ _signInCredentials }, use) => {
    await use(await _signInCredentials.create(false));
  },
  adminUser: async ({ _signInCredentials }, use) => {
    await use(await _signInCredentials.create(true));
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
