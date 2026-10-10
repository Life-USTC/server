import type { RequestEvent, RequestHandler } from "@sveltejs/kit";
import { expect } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { getOAuthRestAudienceUrls } from "@/lib/oauth/resource-urls";
import openapi from "../../public/openapi.generated.json";
import { nodeProtocolTest } from "../shared/node-protocol-fixture";

const modules = import.meta.glob<Record<string, RequestHandler>>(
  "../../src/routes/api/**/+server.ts",
);
const it = nodeProtocolTest
  .extend<{
    rateLimitCalls: { key: string; tier: string }[];
  }>({
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires destructured fixture dependencies.
    rateLimitCalls: async ({}, use) => {
      await use([]);
    },
  })
  .extend({
    protocolBindings: async ({ rateLimitCalls }, use) => {
      const limiter = (tier: string) => ({
        limit: async ({ key }: { key: string }) => {
          rateLimitCalls.push({ key, tier });
          return { success: false };
        },
      });
      await use({
        NODE_ENV: "test",
        USER_WRITE_RATE_LIMITER: limiter("write"),
        USER_BATCH_WRITE_RATE_LIMITER: limiter("batch"),
      });
    },
  });

const batchPaths = new Set([
  "/api/community/comments/batch",
  "/api/workspace/homeworks/completions",
  "/api/workspace/link-pins/batch",
  "/api/workspace/subscriptions",
  "/api/workspace/subscriptions/batch",
  "/api/workspace/subscriptions/import-codes",
  "/api/workspace/todos/batch",
]);

async function sessionCookie(token: string) {
  const context = await getBetterAuthInstance().$context;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(context.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token)),
  );
  return `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${btoa(String.fromCharCode(...signature))}`)}`;
}

it("openapi.authenticated-mutation-rate-limits", {
  tags: ["@OpenAPI/REST"],
}, async ({ isolatedDatabase, protocolRuntime, rateLimitCalls }) => {
  await protocolRuntime.run(async () => {
    const nonce = crypto.randomUUID();
    const clientId = `rest-mutation-${nonce}`;
    type Operation = {
      security?: Record<string, string[]>[];
      "x-oauth-scopes"?: string[];
    };
    const mutations = Object.entries(openapi.paths).flatMap(([path, methods]) =>
      Object.entries(methods).flatMap(([method, raw]) => {
        const operation = raw as Operation;
        if (!["post", "put", "patch", "delete"].includes(method)) return [];
        const scopes = operation["x-oauth-scopes"] ?? [];
        if (
          !path.startsWith("/api/admin/") &&
          !scopes.some((scope) => scope.endsWith(":write"))
        )
          return [];
        return [{ path, method: method.toUpperCase(), scopes }];
      }),
    );
    // Detect accidental narrowing of the inventory as well as exercise newly annotated mutations.
    expect(mutations.length).toBeGreaterThanOrEqual(39);
    const scopes = [...new Set(mutations.flatMap((item) => item.scopes))];
    const { user, admin, consent, sessionToken, adminSessionToken } =
      await isolatedDatabase.owner.$transaction(async (db) => {
        const user = await db.user.create({
          data: { email: `rest-mutation-${nonce}@example.test` },
        });
        const admin = await db.user.create({
          data: {
            email: `rest-mutation-admin-${nonce}@example.test`,
            isAdmin: true,
          },
        });
        await db.oAuthClient.create({
          data: {
            clientId,
            name: "REST gate verification",
            scopes,
            redirectUris: ["https://example.test/callback"],
          },
        });
        const consent = await db.oAuthConsent.create({
          data: { userId: user.id, clientId, scopes },
        });
        const sessionToken = crypto.randomUUID();
        const adminSessionToken = crypto.randomUUID();
        await db.session.createMany({
          data: [
            { userId: user.id, sessionToken },
            { userId: admin.id, sessionToken: adminSessionToken },
          ].map((session) => ({
            ...session,
            expires: new Date(Date.now() + 3600_000),
          })),
        });
        return { user, admin, consent, sessionToken, adminSessionToken };
      });
    const cookie = await protocolRuntime.request(() =>
      sessionCookie(sessionToken),
    );
    const adminCookie = await protocolRuntime.request(() =>
      sessionCookie(adminSessionToken),
    );
    const issuedAt = Math.floor(Date.now() / 1000);
    const token = await protocolRuntime.request(() =>
      signResourceBoundOAuthAccessToken({
        clientId,
        userId: user.id,
        grantId: consent.grantId,
        scopes,
        resources: getOAuthRestAudienceUrls(),
        issuedAt,
        expiresAt: issuedAt + 300,
      }),
    );
    expect(token).toBeTruthy();
    for (const { path, method, scopes: routeScopes } of mutations) {
      const modulePath = `../../src/routes${path.replace(/\{([^}]+)\}/g, "[$1]")}/+server.ts`;
      const load = modules[modulePath];
      expect(load, modulePath).toBeDefined();
      const handler = (await load())[method];
      expect(handler, `${method} ${path}`).toBeTypeOf("function");
      const isAdmin = path.startsWith("/api/admin/");
      const headersList: HeadersInit[] = isAdmin
        ? [{ cookie: adminCookie }]
        : [{ cookie }, { authorization: `Bearer ${token}` }];
      const tier = batchPaths.has(path) ? "batch" : "write";
      const action = isAdmin
        ? `admin:${path.split("/")[3]}:write`
        : `${routeScopes[0].slice(0, -6)}:${tier === "batch" ? "batch-write" : "write"}`;
      for (const headers of [{}, ...headersList]) {
        const calls = rateLimitCalls;
        calls.length = 0;
        const request = new Request(
          `http://localhost:3000${path.replace(/\{[^}]+\}/g, "1")}`,
          {
            method,
            headers: {
              ...headers,
              accept: "application/json",
              "content-type": "application/json",
            },
            body: JSON.stringify({ title: "must not reach the write" }),
          },
        );
        const response = await protocolRuntime.request(() =>
          handler({
            request,
            url: new URL(request.url),
            params: { id: "1", jwId: "1", youngId: "1", organizerId: "1" },
            locals: { locale: "en-us" },
          } as unknown as RequestEvent),
        );
        // Drain the real response to finish request-scoped database cleanup.
        const payload = await response.json();
        const authenticated = Object.keys(headers).length > 0;
        expect(
          response.status,
          `${method} ${path} ${JSON.stringify(Object.keys(headers))}`,
        ).toBe(authenticated ? 429 : 401);
        expect(
          request.bodyUsed,
          `${method} ${path} must reject before reading write input`,
        ).toBe(false);
        if (authenticated) {
          expect(payload).toEqual({ error: "Rate limit exceeded" });
          expect(response.headers.get("Retry-After")).toBe("60");
          expect(calls, `${method} ${path}`).toEqual([
            {
              tier,
              key: JSON.stringify([
                "user-mutation:v1",
                "localhost:3000",
                action,
                isAdmin ? admin.id : user.id,
              ]),
            },
          ]);
        } else expect(calls).toEqual([]);
      }
    }
  });
});
