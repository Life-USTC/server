import { expect } from "@playwright/test";
import { unflatten } from "devalue";
import { test } from "../../../e2e/utils/owned-worker";
import { createSignedDemoCookie } from "../../../shared/demo-token";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });

for (const locale of ["en-us", "zh-cn"] as const)
  test(`demo profile isolates fixed page and API facts, identities and effects ${locale}`, {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const actor = await isolatedWorker.createActor();
      const db = isolatedWorker.database.owner;
      await db.user.update({
        where: { id: actor.id },
        data: {
          name: "Private ordinary profile",
          username: "demo-student",
          image: "https://private.example.test/avatar.png",
          profilePictures: ["https://private.example.test/avatar.png"],
        },
      });
      const snapshot = async () => ({
        users: await db.user.findMany({ orderBy: { id: "asc" } }),
        sessions: await db.session.findMany({
          orderBy: { sessionToken: "asc" },
        }),
        accounts: await db.account.findMany({ orderBy: { id: "asc" } }),
      });
      const ordinary = await request.get("/api/account/profile", {
        headers: { cookie: `${actor.cookie.name}=${actor.cookie.value}` },
      });
      expect(ordinary.status()).toBe(200);
      expect(await ordinary.json()).toMatchObject({
        id: actor.id,
        name: "Private ordinary profile",
        username: "demo-student",
      });
      // The ordinary control may legitimately refresh its real session.
      // Snapshot every persisted field after that control, before any demo request.
      const before = await snapshot();
      const valid = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000),
      });
      const expired = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000) - 901,
      });
      const forged = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000),
        userId: actor.id,
      });
      const cookie = `${valid.name}=${valid.value}; NEXT_LOCALE=${locale}`;
      const secret = { "x-test-storage-secret": "local-test-storage-observer" };
      const probeId = crypto.randomUUID();
      const probe = `/__test/community-effects?id=${probeId}`;
      const headers = {
        ...secret,
        "x-test-community-probe": probeId,
        cookie,
        origin: isolatedWorker.origin,
      };
      const registration = await request.post(`${probe}&io=1`, {
        headers: secret,
      });
      await registration.body();
      expect(registration.status()).toBe(201);
      const fixed = {
        id: "demo:workspace-v1",
        email: "demo@example.test",
        username: "demo-student",
        name:
          locale === "en-us" ? "Demo account · Read only" : "演示账户 · 只读",
        image: null,
        isAdmin: false,
        createdAt: "2026-09-24T09:00:00+08:00",
        updatedAt: "2026-09-24T09:00:00+08:00",
      };
      const privateHeaders = (response: {
        headers(): Record<string, string>;
      }) => {
        expect(response.headers()["cache-control"]).toBe("private, no-store");
        expect(response.headers()["cloudflare-cdn-cache-control"]).toBe(
          "no-store",
        );
        expect(response.headers().vary).toBe("Cookie");
        expect(response.headers()["x-life-public-navigation"]).toBeUndefined();
        expect(response.headers()["x-robots-tag"]).toBe(
          "noindex, nofollow, noarchive",
        );
      };
      try {
        for (const query of ["", `?userId=${actor.id}&id=${actor.id}`]) {
          const api = await request.get(`/api/account/profile${query}`, {
            headers,
          });
          expect(api.status()).toBe(200);
          expect(await api.json()).toEqual(fixed);
          privateHeaders(api);
        }
        for (const query of [
          "",
          "?tab=accounts&message=Success",
          "?tab=danger&message=AccountDisconnected",
        ]) {
          const html = await request.get(`/account/settings/profile${query}`, {
            headers,
          });
          expect(html.status()).toBe(200);
          privateHeaders(html);
          const text = await html.text();
          expect(text).toContain(fixed.username);
          expect(text).toContain(fixed.name);
          expect(text).not.toContain("Private ordinary profile");
          expect(text).not.toContain("private.example.test");
          expect(text).not.toContain(actor.id);
          const data = await request.get(
            `/account/settings/profile/__data.json${query}`,
            { headers },
          );
          expect(data.status()).toBe(200);
          privateHeaders(data);
          const envelope = await data.json();
          const page = unflatten(envelope.nodes.at(-1).data) as {
            user: Record<string, unknown>;
            tab: string;
            message: unknown;
            demo: { displayName: string };
          };
          expect(page.user).toEqual({
            ...fixed,
            createdAt: new Date(fixed.createdAt),
            updatedAt: new Date(fixed.updatedAt),
            profilePictures: [],
          });
          expect(page.tab).toBe("profile");
          expect(page.message).toBeNull();
          expect(page.demo.displayName).toBe(fixed.name);
        }
        for (const path of [
          "/account/settings/profile",
          "/api/account/profile",
        ]) {
          const head = await request.head(path, { headers });
          expect(head.status()).toBe(200);
          expect(await head.text()).toBe("");
          privateHeaders(head);
        }
        for (const path of [
          "/account/settings",
          "/account/settings?tab=profile",
          "/account/settings/preferences",
          "/account/settings/accounts",
          "/account/settings/security",
          "/account/settings/authorizations",
          "/account/settings/danger",
          "/account/settings/unknown",
          "/account/settings/profile/unknown",
          "/account/settings/profile/__data.json/__data.json",
          "/api/account/profile/unknown",
          "/community/users/demo-student",
          "/community/users/demo:workspace-v1",
        ]) {
          const response = await request.get(path, {
            headers,
            maxRedirects: 0,
          });
          expect(response.status(), path).toBe(403);
          expect(await response.json()).toEqual({ error: "DEMO_READ_ONLY" });
          privateHeaders(response);
        }
        for (const [method, path] of [
          ["POST", "/account/settings/profile?/updateProfile"],
          ["POST", "/account/settings/profile?/linkAccount"],
          ["POST", "/account/settings/profile?/unlinkAccount"],
          ["POST", "/api/account/profile"],
          ["PATCH", "/api/account/profile"],
          ["DELETE", "/api/account/profile"],
          ["POST", "/api/auth/update-user"],
          ["POST", "/api/workspace/uploads"],
        ]) {
          const response = await request.fetch(path, {
            method,
            headers,
            data: {
              name: "Forbidden edit",
              image: "https://external.example.test/forbidden.png",
              userId: actor.id,
            },
            maxRedirects: 0,
          });
          expect(response.status(), `${method} ${path}`).toBe(403);
          expect(await response.json()).toEqual({ error: "DEMO_READ_ONLY" });
          privateHeaders(response);
        }
        for (const [identity, status] of [
          ["life-ustc.demo=invalid", 401],
          [`${expired.name}=${expired.value}`, 401],
          [`${forged.name}=${forged.value}`, 401],
          [`${cookie}; ${actor.cookie.name}=${actor.cookie.value}`, 403],
          [`${cookie}; ${valid.name}=${valid.value}`, 401],
        ] as const) {
          for (const path of [
            "/api/account/profile",
            "/account/settings/profile/__data.json",
          ]) {
            const response = await request.get(path, {
              headers: { ...headers, cookie: identity },
              maxRedirects: 0,
            });
            expect(response.status(), path).toBe(status);
            await response.body();
            privateHeaders(response);
          }
          const html = await request.get("/account/settings/profile", {
            headers: { ...headers, cookie: identity, accept: "text/html" },
            maxRedirects: 0,
          });
          expect(html.status()).toBe(status === 401 ? 303 : 403);
          if (status === 401) {
            expect(html.headers().location).toBe("/account/sign-in");
            expect(html.headers()["set-cookie"]).toMatch(/^life-ustc\.demo=;/);
          }
          await html.body();
          privateHeaders(html);
        }
        const mixedBearer = await request.get("/api/account/profile", {
          headers: { ...headers, authorization: "Bearer untrusted" },
        });
        expect(mixedBearer.status()).toBe(403);
        await mixedBearer.body();
        privateHeaders(mixedBearer);
        const observed = await request.get(probe, { headers: secret });
        expect(observed.status()).toBe(200);
        const effects = await observed.json();
        expect(effects).toMatchObject({
          purges: [],
          messages: [],
          backgroundErrors: [],
          io: { bindings: [], outbound: [] },
        });
        expect(effects.requests.length).toBeGreaterThan(20);
        expect(
          effects.requests.every(
            (entry: { outcome: string }) => entry.outcome === "fulfilled",
          ),
        ).toBe(true);
        expect(await snapshot()).toEqual(before);
      } finally {
        const removed = await request.delete(probe, { headers: secret });
        await removed.body();
        expect(removed.status()).toBe(204);
      }
    });
  });
