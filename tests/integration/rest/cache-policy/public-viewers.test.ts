import { type APIRequestContext, expect } from "@playwright/test";
import {
  OAUTH_CODE_RESPONSE_TYPE,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { restReadScope } from "@/lib/oauth/scope-registry";
import { authorizeDeviceBearer } from "../../../e2e/utils/oauth-device-bearer";
import { test } from "../../../e2e/utils/owned-worker";
import { arrangeBusTimetable } from "../../../shared/bus-timetable";
import { createCatalogContractFixture } from "../../../shared/catalog-contract-fixture";

test.use({ storageState: { cookies: [], origins: [] } });

for (const domain of ["Catalog", "CatalogLink", "Young", "Bus"] as const)
  test(`rendering-and-cache.personal-overlays-9 ${domain}`, {
    tag: `@${domain}/REST`,
  }, async ({ isolatedWorker, request, run }) => {
    test.setTimeout(90_000);
    await run(async () => {
      const db = isolatedWorker.database.owner;
      const catalog = await createCatalogContractFixture(db);
      const section = catalog.sections[0];
      await arrangeBusTimetable(db);
      await db.$transaction(async (tx) => {
        await tx.scheduleGroup.create({
          data: {
            jwId: 1,
            sectionId: section.id,
            no: 1,
            limitCount: 30,
            stdCount: 1,
            actualPeriods: 2,
            isDefault: true,
            schedules: {
              create: {
                sectionId: section.id,
                date: new Date("2035-09-17T00:00:00Z"),
                weekday: 1,
                startTime: 800,
                endTime: 935,
                startUnit: 1,
                endUnit: 2,
                weekIndex: 1,
                periods: 2,
                customPlace: "Public cache classroom",
              },
            },
          },
        });
        await tx.youngOrganizer.create({
          data: {
            id: "public-cache-organizer",
            name: "Public cache organizer",
            normalizedName: "public-cache-organizer",
            events: {
              create: {
                youngId: "public-cache-event",
                name: "Public cache event",
                isActive: true,
                startAt: new Date("2035-09-17T10:00:00Z"),
                endAt: new Date("2035-09-17T12:00:00Z"),
                rawJson: {},
              },
            },
          },
        });
      });
      const client = await db.oAuthClient.create({
        data: {
          name: `public-cache-policy-${crypto.randomUUID()}`,
          clientId: crypto.randomUUID(),
          clientSecret: crypto.randomUUID(),
          redirectUris: [`${isolatedWorker.origin}/oauth-e2e/callback`],
          type: "public",
          disabled: false,
          scopes: [restReadScope("account.profile")],
          grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
          tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
          responseTypes: [OAUTH_CODE_RESPONSE_TYPE],
          requirePKCE: true,
          metadata: { source: "e2e_fixture" },
        },
      });
      const users: Array<{
        id: string;
        name: string;
        email: string;
        username: string | null;
      }> = [];
      const contexts: Array<{
        request: APIRequestContext;
        headers: Record<string, string>;
      }> = [];
      for (const index of [0, 1]) {
        const user = await db.user.create({
          data: {
            username: `cache${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
            name: `Private cache viewer ${index}`,
            email: `cache-${crypto.randomUUID()}@example.test`,
            todos: {
              create: { title: `Private task only for viewer ${index}` },
            },
          },
        });
        users.push(user);
        if (index === 0) {
          await db.userSectionSubscription.create({
            data: { userId: user.id, sectionId: section.id },
          });
        }
        const session = await isolatedWorker.createSession(user.id);
        const cookie = session.cookie;
        const sessionHeaders = {
          cookie: `${cookie.name}=${cookie.value}; NEXT_LOCALE=${index === 0 ? "en-us" : "zh-cn"}`,
        };
        contexts.push({ request: session.request, headers: sessionHeaders });
        const profile = await session.request.get("/api/account/profile", {
          headers: sessionHeaders,
        });
        expect(profile.status()).toBe(200);
        expect(await profile.json()).toMatchObject({ id: user.id });
        const token = await authorizeDeviceBearer(
          session.request,
          isolatedWorker.origin,
          client.clientId,
          restReadScope("account.profile"),
        );
        // Native request has no session: these calls must authenticate by the
        // genuinely issued device-grant token, independently for each owner.
        const bearerHeaders = { authorization: `Bearer ${token}` };
        contexts.push({ request, headers: bearerHeaders });
        expect((await request.storageState()).cookies).toEqual([]);
        const bearerProfile = await request.get("/api/account/profile", {
          headers: bearerHeaders,
        });
        expect(bearerProfile.status()).toBe(200);
        expect(await bearerProfile.json()).toMatchObject({ id: user.id });
        expect((await request.storageState()).cookies).toEqual([]);
      }

      const teacher = catalog.teachers[0];
      const paths = {
        Catalog: [
          "/api/catalog/courses",
          `/api/catalog/courses/${catalog.courses[0].jwId}`,
          "/api/catalog/sections",
          `/api/catalog/sections/${section.jwId}`,
          `/api/catalog/sections/${section.jwId}/schedules`,
          `/api/catalog/sections/${section.jwId}/schedule-groups`,
          "/api/catalog/teachers",
          `/api/catalog/teachers/${teacher.id}`,
          "/api/catalog/semesters",
          "/api/catalog/metadata",
        ],
        CatalogLink: ["/api/catalog/links"],
        Young: ["/api/catalog/young-events", "/api/catalog/young-organizers"],
        Bus: ["/api/catalog/bus/routes"],
      }[domain];
      for (const path of paths) {
        const url = `${path}?locale=zh-cn`;
        expect((await request.storageState()).cookies, url).toEqual([]);
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
        for (const { request: context, headers: authHeaders } of contexts) {
          if (context === request)
            expect((await request.storageState()).cookies, url).toEqual([]);
          const authenticated = await context.get(url, {
            headers: authHeaders,
          });
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
    });
  });
