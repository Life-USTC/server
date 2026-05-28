import { expect, type Page } from "@playwright/test";
import { DEV_SEED } from "./dev-seed";
import { gotoAndWaitForReady, waitForUiSettled } from "./page-ready";

const DEV_DEBUG_LOGIN_BUTTON = /Debug User \(Dev\)|调试用户（开发）/i;
const DEV_ADMIN_LOGIN_BUTTON = /Admin User \(Dev\)|调试管理员（开发）/i;
const SESSION_RETRY_ATTEMPTS = 8;
const SESSION_RETRY_TIMEOUT_MS = 15_000;

type AuthRole = "debug" | "admin";
type AuthStorageState = Awaited<
  ReturnType<ReturnType<Page["context"]>["storageState"]>
>;

const authStorageStateCache = new Map<AuthRole, AuthStorageState>();

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function expectPagePath(page: Page, path: string) {
  const pattern = path === "/" ? "\\/$" : escapeForRegExp(path);
  await expect(page).toHaveURL(new RegExp(`${pattern}$`));
}

type SignInProvider = "ustc" | "github" | "google";

const SIGN_IN_PROVIDER_LABELS: Record<SignInProvider, RegExp> = {
  ustc: /USTC/i,
  github: /GitHub/i,
  google: /Google/i,
};

async function expectAuthenticatedSession(
  page: Page,
  options: { isAdmin?: boolean } = {},
) {
  await expect(async () => {
    const sessionResponse = await page.request.get("/api/auth/get-session");
    expect(sessionResponse.status()).toBe(200);
    const session = (await sessionResponse.json()) as {
      user?: { id?: string; isAdmin?: boolean };
    };

    expect(typeof session.user?.id).toBe("string");
    if (options.isAdmin) {
      expect(session.user?.isAdmin).toBe(true);
    }
  }).toPass({
    intervals: Array.from(
      { length: SESSION_RETRY_ATTEMPTS - 1 },
      (_, index) => 500 * (index + 1),
    ),
    timeout: SESSION_RETRY_TIMEOUT_MS,
  });
}

async function applyCachedSession(
  page: Page,
  role: AuthRole,
  expectedPath: string,
) {
  const storageState = authStorageStateCache.get(role);
  if (!storageState) {
    return false;
  }

  try {
    await page.context().addCookies(storageState.cookies);
    await gotoAndWaitForReady(page, expectedPath);
    await completeWelcomeProfileIfNeeded(page, role, expectedPath);
    await expectPagePath(page, expectedPath);
    await expectAuthenticatedSession(page, { isAdmin: role === "admin" });
    return true;
  } catch {
    authStorageStateCache.delete(role);
    return false;
  }
}

async function completeWelcomeProfileIfNeeded(
  page: Page,
  role: AuthRole,
  expectedPath: string,
) {
  if (role !== "debug" || expectedPath.startsWith("/welcome")) {
    return;
  }
  if (!page.url().includes("/welcome")) {
    return;
  }

  const nameInput = page.getByRole("textbox", { name: /^(姓名|Name)\b/i });
  const usernameInput = page.getByRole("textbox", {
    name: /^(用户名|Username)\b/i,
  });
  if ((await nameInput.count()) === 0 || (await usernameInput.count()) === 0) {
    return;
  }

  await expect(nameInput).toBeVisible();
  await nameInput.fill(DEV_SEED.debugName);
  await usernameInput.fill(DEV_SEED.debugUsername);
  await page.getByRole("button", { name: /继续|Continue/i }).click();
  await gotoAndWaitForReady(page, expectedPath);
}

async function signInWithDevButton(
  page: Page,
  role: AuthRole,
  callbackPath: string,
  expectedPath: string,
) {
  await gotoAndWaitForReady(
    page,
    `/signin?callbackUrl=${encodeURIComponent(callbackPath)}`,
  );

  if (!page.url().includes("/signin")) {
    await completeWelcomeProfileIfNeeded(page, role, expectedPath);
    await expectPagePath(page, expectedPath);
    await waitForUiSettled(page);
    await expectAuthenticatedSession(page, { isAdmin: role === "admin" });
    await expect(page.locator("#main-content")).toBeVisible();
    authStorageStateCache.set(role, await page.context().storageState());
    return;
  }

  const buttonName =
    role === "admin" ? DEV_ADMIN_LOGIN_BUTTON : DEV_DEBUG_LOGIN_BUTTON;
  const button = page.getByRole("button", { name: buttonName }).first();
  try {
    await expect(button).toBeVisible({ timeout: 1_000 });
  } catch (error) {
    try {
      await expectAuthenticatedSession(page, { isAdmin: role === "admin" });
      await expect(page.locator("#main-content")).toBeVisible();
      authStorageStateCache.set(role, await page.context().storageState());
      return;
    } catch {
      throw error;
    }
  }
  await button.click();

  await page.waitForURL((url) => !url.pathname.startsWith("/signin"), {
    timeout: 15_000,
    waitUntil: "domcontentloaded",
  });
  await completeWelcomeProfileIfNeeded(page, role, expectedPath);
  await expectPagePath(page, expectedPath);
  await waitForUiSettled(page);
  await expectAuthenticatedSession(page, { isAdmin: role === "admin" });
  await expect(page.locator("#main-content")).toBeVisible();

  authStorageStateCache.set(role, await page.context().storageState());
}

export async function expectRequiresSignIn(
  page: Page,
  path: string,
  options: {
    providers?: SignInProvider[];
  } = {},
) {
  await gotoAndWaitForReady(page, path, {
    expectMainContent: false,
  });

  await expect(page).toHaveURL(/\/signin(?:\?.*)?$/);
  for (const provider of options.providers ?? ["ustc"]) {
    await expect(
      page.getByRole("button", { name: SIGN_IN_PROVIDER_LABELS[provider] }),
    ).toBeVisible();
  }
}

export async function signInAsDebugUser(
  page: Page,
  callbackPath = "/",
  expectedPath = callbackPath,
  options: { ui?: boolean } = {},
) {
  if (!options.ui && (await applyCachedSession(page, "debug", expectedPath))) {
    return;
  }

  await signInWithDevButton(page, "debug", callbackPath, expectedPath);
}

export async function signInAsDevAdmin(
  page: Page,
  callbackPath = "/",
  expectedPath = callbackPath,
  options: { ui?: boolean } = {},
) {
  if (!options.ui && (await applyCachedSession(page, "admin", expectedPath))) {
    return;
  }

  await signInWithDevButton(page, "admin", callbackPath, expectedPath);
}
