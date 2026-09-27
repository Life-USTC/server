import { type APIResponse, expect, test } from "@playwright/test";
import {
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { restReadScope } from "@/lib/oauth/scope-registry";
import { DEV_SEED } from "../../../utils/dev-seed";
import {
  createOAuthClientFixture,
  deleteOAuthClientsByName,
  PLAYWRIGHT_BASE_URL,
} from "../../../utils/e2e-db";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { authorizeDeviceBearer } from "../../../utils/oauth-device-bearer";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

async function createUsers() {
  return withE2ePrisma(async (db) => {
    const users = [];
    for (const index of [0, 1]) {
      const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
      users.push(
        await db.user.create({
          data: {
            name: `Shell viewer ${suffix}`,
            username: `shell${suffix}`,
            email: `shell-${suffix}@example.test`,
            todos:
              index === 0
                ? {
                    create: [
                      { title: `Shell task ${suffix} A` },
                      { title: `Shell task ${suffix} B` },
                    ],
                  }
                : undefined,
          },
        }),
      );
    }
    const section = await db.section.findUniqueOrThrow({
      where: { jwId: DEV_SEED.section.jwId },
    });
    await db.userSectionSubscription.create({
      data: { userId: users[0].id, sectionId: section.id },
    });
    return users;
  });
}

async function cleanup(users: Awaited<ReturnType<typeof createUsers>>) {
  await withE2ePrisma(async (db) => {
    const ids = users.map((user) => user.id);
    await db.auditLog.deleteMany({
      where: { OR: [{ userId: { in: ids } }, { subjectUserId: { in: ids } }] },
    });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  });
}

function expectPrivate(response: APIResponse) {
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect(response.headers()["cloudflare-cdn-cache-control"]).toBe("no-store");
  expect(response.headers().vary?.split(/,\s*/)).toContain("Cookie");
}

test("rendering-and-cache.personal-overlays-4", async ({
  browser,
  request,
}) => {
  const users = await createUsers();
  const clientName = `shell-projection-${crypto.randomUUID()}`;
  const client = await createOAuthClientFixture({
    name: clientName,
    scopes: [restReadScope("account.profile")],
    grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
    tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
  });
  try {
    const anonymous = await request.get("/_internal/shell-bootstrap");
    expect(anonymous.status()).toBe(200);
    expectPrivate(anonymous);
    expect(await anonymous.json()).toEqual({ viewer: null, navigation: null });
    for (const [index, user] of users.entries()) {
      const context = await browser.newContext({
        baseURL: PLAYWRIGHT_BASE_URL,
      });
      try {
        await context.addCookies([await createSignedSessionCookie(user.id)]);
        const response = await context.request.get(
          "/_internal/shell-bootstrap",
        );
        expect(response.status()).toBe(200);
        expectPrivate(response);
        const payload = await response.json();
        expect(payload.viewer).toEqual({
          id: user.id,
          name: user.name,
          username: user.username,
          image: null,
          isAdmin: false,
        });
        expect(payload.navigation).toMatchObject({
          userId: user.id,
          pendingTodosCount: index === 0 ? 2 : 0,
          subscribedSectionCount: index === 0 ? 1 : 0,
        });
        expect(Object.keys(payload.navigation).sort()).toEqual([
          "calendarItemsCount",
          "examsCount",
          "pendingHomeworksCount",
          "pendingTodosCount",
          "subscribedSectionCount",
          "unreadActivityNotificationsCount",
          "userId",
        ]);
        const page = await context.newPage();
        for (const path of [
          "/catalog/courses",
          "/account/settings/preferences",
        ]) {
          const bootstrap = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === "/_internal/shell-bootstrap",
          );
          await gotoAndWaitForReady(page, path);
          const hydrated = await bootstrap;
          expect(hydrated.request().resourceType()).toBe("fetch");
          expect(hydrated.headers()["cache-control"]).toBe("private, no-store");
          expect(await hydrated.json()).toEqual(payload);
          await expect(page.locator("#app-user-menu")).toContainText(user.name);
        }
        expect(JSON.stringify(payload)).not.toContain(user.email);
        expect(JSON.stringify(payload)).not.toContain(users[1 - index].id);
        const token = await authorizeDeviceBearer(
          context.request,
          client.clientId,
          restReadScope("account.profile"),
        );
        const authorization = `Bearer ${token}`;
        const profile = await request.get("/api/account/profile", {
          headers: { authorization },
        });
        expect(profile.status()).toBe(200);
        expect(await profile.json()).toMatchObject({ id: user.id });
        for (const transport of [request, context.request]) {
          const denied = await transport.get("/_internal/shell-bootstrap", {
            headers: { authorization },
          });
          expect(denied.status()).toBe(401);
          expectPrivate(denied);
          expect(await denied.json()).toEqual({
            error: "Session authentication required",
          });
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await deleteOAuthClientsByName(clientName);
    await cleanup(users);
  }
});

test("rendering-and-cache.personal-overlays-5", async ({ browser }) => {
  const users = await createUsers();
  try {
    for (const user of users) {
      const cookie = await createSignedSessionCookie(user.id);
      for (const javaScriptEnabled of [false, true]) {
        const context = await browser.newContext({
          baseURL: PLAYWRIGHT_BASE_URL,
          javaScriptEnabled,
          viewport: { width: 1280, height: 900 },
        });
        try {
          await context.addCookies([
            cookie,
            { name: "NEXT_LOCALE", value: "en-us", url: PLAYWRIGHT_BASE_URL },
          ]);
          const page = await context.newPage();
          const bootstrapRequests: string[] = [];
          page.on("request", (request) => {
            if (
              new URL(request.url()).pathname === "/_internal/shell-bootstrap"
            )
              bootstrapRequests.push(request.url());
          });
          const response = javaScriptEnabled
            ? await gotoAndWaitForReady(page, "/workspace/todos")
            : await page.goto("/workspace/todos");
          if (response) expect(response.status()).toBe(200);
          await expect(page.locator("#app-user-menu")).toContainText(user.name);
          const projection = await context.request.get(
            "/_internal/shell-bootstrap",
          );
          expect(projection.status()).toBe(200);
          const payload = await projection.json();
          expect(payload.viewer.id).toBe(user.id);
          const navigation = page.locator('[data-shell-navigation="desktop"]');
          for (const [path, field] of [
            ["calendar", "calendarItemsCount"],
            ["homeworks", "pendingHomeworksCount"],
            ["todos", "pendingTodosCount"],
            ["exams", "examsCount"],
            ["subscriptions", "subscribedSectionCount"],
          ] as const) {
            const link = navigation.locator(`a[href="/workspace/${path}"]`);
            await expect(link).toHaveCount(1);
            const badge = link
              .locator("xpath=ancestor::*[@data-slot='sidebar-menu-item'][1]")
              .locator("[data-slot='sidebar-menu-badge']");
            const count = payload.navigation[field];
            if (count > 0) await expect(badge).toHaveText(String(count));
            else await expect(badge).toHaveCount(0);
          }
          expect(bootstrapRequests).toEqual([]);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await cleanup(users);
  }
});
