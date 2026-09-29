import { type APIRequestContext, expect, test } from "@playwright/test";
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
import { createSignedSessionCookie } from "../../../utils/signed-session-cookie";

test("rendering-and-cache.personal-overlays-9", async ({
  playwright,
  request,
}) => {
  test.setTimeout(90_000);
  const clientName = `public-cache-policy-${crypto.randomUUID()}`;
  const client = await createOAuthClientFixture({
    name: clientName,
    scopes: [restReadScope("account.profile")],
    grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
    tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
  });
  const users: Array<{
    id: string;
    name: string;
    email: string;
    username: string | null;
  }> = [];
  const contexts: APIRequestContext[] = [];
  try {
    for (const index of [0, 1]) {
      const user = await withE2ePrisma((db) =>
        db.user.create({
          data: {
            username: `cache${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
            name: `Private cache viewer ${index}`,
            email: `cache-${crypto.randomUUID()}@example.test`,
            todos: {
              create: { title: `Private task only for viewer ${index}` },
            },
          },
        }),
      );
      users.push(user);
      if (index === 0) {
        await withE2ePrisma(async (db) => {
          const section = await db.section.findUniqueOrThrow({
            where: { jwId: DEV_SEED.section.jwId },
          });
          await db.userSectionSubscription.create({
            data: { userId: user.id, sectionId: section.id },
          });
        });
      }
      const cookie = await createSignedSessionCookie(user.id);
      const session = await playwright.request.newContext({
        baseURL: PLAYWRIGHT_BASE_URL,
        extraHTTPHeaders: {
          cookie: `${cookie.name}=${cookie.value}; NEXT_LOCALE=${index === 0 ? "en-us" : "zh-cn"}`,
        },
      });
      contexts.push(session);
      const profile = await session.get("/api/account/profile");
      expect(profile.status()).toBe(200);
      expect(await profile.json()).toMatchObject({ id: user.id });
      const token = await authorizeDeviceBearer(
        session,
        PLAYWRIGHT_BASE_URL,
        client.clientId,
        restReadScope("account.profile"),
      );
      const bearer = await playwright.request.newContext({
        baseURL: PLAYWRIGHT_BASE_URL,
        extraHTTPHeaders: { authorization: `Bearer ${token}` },
      });
      contexts.push(bearer);
      const bearerProfile = await bearer.get("/api/account/profile");
      expect(bearerProfile.status()).toBe(200);
      expect(await bearerProfile.json()).toMatchObject({ id: user.id });
    }

    const teacher = await withE2ePrisma((db) =>
      db.teacher.findFirstOrThrow({
        where: { code: DEV_SEED.teacher.code },
        select: { id: true },
      }),
    );
    const paths = [
      "/api/catalog/courses",
      `/api/catalog/courses/${DEV_SEED.course.jwId}`,
      "/api/catalog/sections",
      `/api/catalog/sections/${DEV_SEED.section.jwId}`,
      `/api/catalog/sections/${DEV_SEED.section.jwId}/schedules`,
      `/api/catalog/sections/${DEV_SEED.section.jwId}/schedule-groups`,
      "/api/catalog/teachers",
      `/api/catalog/teachers/${teacher.id}`,
      "/api/catalog/semesters",
      "/api/catalog/metadata",
      "/api/catalog/links",
      "/api/catalog/young-events",
      "/api/catalog/young-organizers",
      "/api/catalog/bus/routes",
    ];
    for (const path of paths) {
      const url = `${path}?locale=zh-cn`;
      const anonymous = await request.get(url);
      expect(anonymous.status(), url).toBe(200);
      const publicBody = await anonymous.json();
      const headers = anonymous.headers();
      expect(headers["cache-control"], url).toMatch(/\bpublic\b/);
      expect(headers["cloudflare-cdn-cache-control"], url).toMatch(
        /\bpublic\b/,
      );
      const serialized = JSON.stringify(publicBody);
      for (const user of users) {
        expect(serialized, url).not.toContain(user.id);
        expect(serialized, url).not.toContain(user.name);
        expect(serialized, url).not.toContain(user.email);
      }
      expect(serialized, url).not.toContain("Private task only for viewer");
      for (const context of contexts) {
        const authenticated = await context.get(url);
        expect(authenticated.status(), url).toBe(200);
        expect(await authenticated.json(), url).toEqual(publicBody);
        expect(authenticated.headers()["cache-control"], url).toBe(
          headers["cache-control"],
        );
        expect(
          authenticated.headers()["cloudflare-cdn-cache-control"],
          url,
        ).toBe(headers["cloudflare-cdn-cache-control"]);
        expect(authenticated.headers()["set-cookie"], url).toBeUndefined();
      }
    }
  } finally {
    await Promise.all(contexts.map((context) => context.dispose()));
    await deleteOAuthClientsByName(clientName);
    await withE2ePrisma(async (db) => {
      const ids = users.map((user) => user.id);
      await db.auditLog.deleteMany({
        where: {
          OR: [{ userId: { in: ids } }, { subjectUserId: { in: ids } }],
        },
      });
      await db.user.deleteMany({ where: { id: { in: ids } } });
    });
  }
});
