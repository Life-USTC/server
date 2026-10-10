import { createLocalAccountIssuer } from "@better-auth/core/db";
import { type APIRequestContext, expect } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import {
  DEV_ADMIN_PROVIDER_ID,
  DEV_DEBUG_PROVIDER_ID,
} from "@/lib/auth/provider-ids";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test as workerTest } from "../../../e2e/utils/owned-worker";

export const authAccounts = {
  user: { username: "dev-user", name: "Private normal account" },
  admin: { username: "dev-admin", name: "Private administrator" },
};

async function prepareAccount(
  worker: IsolatedWorker,
  isAdmin: boolean,
  assertOpen: () => void,
) {
  assertOpen();
  const account = isAdmin ? authAccounts.admin : authAccounts.user;
  const password = await hashPassword(
    isAdmin ? "dev-admin-password" : "dev-debug-password",
  );
  assertOpen();
  return worker.database.owner.$transaction(async (db) => {
    assertOpen();
    const user = await db.user.create({
      data: {
        ...account,
        email: `${account.username}@debug.local`,
        emailVerified: true,
        isAdmin,
        createdAt: new Date("2026-09-01T00:00:00Z"),
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
    assertOpen();
    return user;
  });
}

async function prepareCatalog(worker: IsolatedWorker, assertOpen: () => void) {
  assertOpen();
  return worker.database.owner.$transaction(async (db) => {
    assertOpen();
    const semester = await db.semester.create({
      data: {
        jwId: 1_800_000_000,
        code: "private-auth-semester",
        nameCn: "独立账户学期",
      },
    });
    const course = await db.course.create({
      data: {
        jwId: 1_800_000_000,
        code: "PRIVATE-AUTH",
        nameCn: "独立账户课程",
      },
    });
    const section = await db.section.create({
      data: {
        jwId: 1_800_000_000,
        code: "PRIVATE-AUTH-SECTION",
        semesterId: semester.id,
        courseId: course.id,
      },
    });
    assertOpen();
    return section;
  });
}

type Account = Awaited<ReturnType<typeof prepareAccount>>;
type CatalogSection = Awaited<ReturnType<typeof prepareCatalog>>;

/** Arrange credentials only; authentication must go through the real provider. */
export const test = workerTest.extend<{
  _authSetup: {
    account: (isAdmin: boolean) => Promise<Account>;
    catalog: () => Promise<CatalogSection>;
  };
  account: Account;
  adminAccount: Account;
  catalogSection: CatalogSection;
}>({
  _authSetup: async ({ isolatedWorker, run }, use) => {
    let closing = false;
    const assertOpen = () => {
      if (closing) throw new Error("Auth account setup is closing");
    };
    try {
      await use({
        account: (isAdmin) =>
          run(() => prepareAccount(isolatedWorker, isAdmin, assertOpen)),
        catalog: () => run(() => prepareCatalog(isolatedWorker, assertOpen)),
      });
    } finally {
      // Cancel pending preparation before the prerequisite run owner drains it.
      closing = true;
    }
  },
  account: async ({ _authSetup }, use) => {
    await use(await _authSetup.account(false));
  },
  adminAccount: async ({ _authSetup }, use) => {
    await use(await _authSetup.account(true));
  },
  catalogSection: async ({ _authSetup }, use) => {
    await use(await _authSetup.catalog());
  },
});

export async function signIn(
  request: APIRequestContext,
  account: Pick<Account, "id" | "isAdmin">,
) {
  const response = await request.post("/account/sign-in", {
    form: {
      providerId: account.isAdmin
        ? DEV_ADMIN_PROVIDER_ID
        : DEV_DEBUG_PROVIDER_ID,
      callbackUrl: "/",
    },
  });
  expect([200, 302, 303]).toContain(response.status());

  const sessionResponse = await request.get("/api/auth/get-session");
  expect(sessionResponse.status()).toBe(200);
  const session = (await sessionResponse.json()) as {
    user?: { id?: string; isAdmin?: boolean };
  } | null;
  expect(typeof session?.user?.id).toBe("string");
  expect(session?.user?.id).toBe(account.id);
  expect(session?.user?.isAdmin).toBe(account.isAdmin);
}
