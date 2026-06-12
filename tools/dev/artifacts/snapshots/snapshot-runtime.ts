import type { BrowserContext, Page } from "@playwright/test";
import { chromium, expect } from "@playwright/test";
import { prisma } from "@/lib/db/prisma";
import type { SnapshotAuth } from "./snapshot-cases";

const DEBUG_LOGIN_BUTTON = /Debug User \(Dev\)|调试用户（开发）/i;
const ADMIN_LOGIN_BUTTON = /Admin User \(Dev\)|调试管理员（开发）/i;
const SNAPSHOT_CLIENT_NAME_PREFIX = "mcp-snapshot-";

export function launchSnapshotBrowser() {
  return chromium.launch();
}

export async function signInForSnapshot(
  page: Page,
  auth: SnapshotAuth,
  callbackPath = "/",
) {
  if (auth === "public") return;

  await page.context().clearCookies();
  await page.goto(`/signin?callbackUrl=${encodeURIComponent(callbackPath)}`, {
    waitUntil: "domcontentloaded",
  });

  const buttonName = auth === "admin" ? ADMIN_LOGIN_BUTTON : DEBUG_LOGIN_BUTTON;
  await page.getByRole("button", { name: buttonName }).first().click();
  await page.waitForURL((url) => !url.pathname.startsWith("/signin"), {
    timeout: 30_000,
    waitUntil: "domcontentloaded",
  });

  await expect
    .poll(
      async () => {
        const sessionResponse = await page.request.get(
          "/api/auth/get-session?disableCookieCache=true",
        );
        if (sessionResponse.status() !== 200) return false;
        const session = (await sessionResponse.json()) as {
          user?: { isAdmin?: boolean };
        } | null;
        return auth === "admin"
          ? session?.user?.isAdmin === true
          : Boolean(session?.user);
      },
      { timeout: 10_000 },
    )
    .toBe(true);
}

export async function createAuthedPage(
  context: BrowserContext,
  auth: SnapshotAuth,
) {
  const page = await context.newPage();
  await signInForSnapshot(page, auth);
  return page;
}

export function createSnapshotOAuthClientName() {
  return `${SNAPSHOT_CLIENT_NAME_PREFIX}${Date.now()}`;
}

export async function cleanupSnapshotOAuthClients() {
  await prisma.oAuthClient.deleteMany({
    where: { name: { startsWith: SNAPSHOT_CLIENT_NAME_PREFIX } },
  });
}

export async function disconnectSnapshotOAuthCleanup() {
  await prisma.$disconnect();
}
