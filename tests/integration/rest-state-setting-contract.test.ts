import { createServer, type Server } from "node:http";
import type { RequestEvent, RequestHandler } from "@sveltejs/kit";
import { getRequest, setResponse } from "@sveltejs/kit/node";
import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { setCalendarExportRebuildSenderForTest } from "@/features/calendar/server/calendar-export-queue";
import { USTC_CATALOG_LINKS } from "@/features/catalog-links/lib/catalog-links";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma } from "@/lib/db/prisma";
import { getOAuthRestAudienceUrls } from "@/lib/oauth/resource-urls";
import openapi from "../../public/openapi.generated.json";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const modules = import.meta.glob<Record<string, RequestHandler>>(
  "../../src/routes/api/**/+server.ts",
);
const routes = Object.entries(modules)
  .map(([file, load]) => {
    const path = file
      .replace("../../src/routes", "")
      .replace("/+server.ts", "");
    const names: string[] = [];
    const pattern = new RegExp(
      `^${path.replace(/\[([^\]]+)\]/g, (_, name: string) => {
        names.push(name.replace(/^\.\.\./, ""));
        return name.startsWith("...") ? "(.+)" : "([^/]+)";
      })}$`,
    );
    return { path, names, pattern, load };
  })
  .sort(
    (a, b) =>
      Number(a.path.includes("[...")) - Number(b.path.includes("[...")) ||
      a.names.length - b.names.length ||
      b.path.length - a.path.length,
  );
let origin: string;
let server: Server;
let rateLimitMode: "limited" | "unavailable" | undefined;
const budgetCalls: string[] = [];
beforeAll(async () => {
  setCalendarExportRebuildSenderForTest(async () => {});
  server = createServer(async (incoming, outgoing) => {
    try {
      const request = await getRequest({ request: incoming, base: origin });
      const url = new URL(request.url);
      const route = routes.find(({ pattern }) => pattern.test(url.pathname));
      if (!route) throw new Error("Unknown fixture route");
      const match = route.pattern.exec(url.pathname);
      if (!match) throw new Error("Route did not match");
      const params = Object.fromEntries(
        route.names.map((name, i) => [name, match[i + 1]]),
      );
      const handler = (await route.load())[request.method];
      const invoke = () =>
        handler({
          request,
          url,
          params,
          locals: { locale: "en-us" },
        } as unknown as RequestEvent);
      await setResponse(
        outgoing,
        await (rateLimitMode
          ? runWithCloudflareRuntimeEnv(
              {
                APP_PUBLIC_ORIGIN: "http://localhost:3000",
                DATABASE_URL: process.env.DATABASE_URL,
                HYPERDRIVE: { connectionString: process.env.DATABASE_URL },
                HYPERDRIVE_AUTH: {
                  connectionString: process.env.AUTH_DATABASE_URL,
                },
                NODE_ENV: "test",
                USER_WRITE_RATE_LIMITER: {
                  limit: async ({ key }: { key: string }) => {
                    budgetCalls.push(key);
                    if (rateLimitMode === "unavailable")
                      throw new Error("Fixture limiter unavailable");
                    return { success: false };
                  },
                },
              },
              invoke,
            )
          : invoke()),
      );
    } catch (error) {
      outgoing.statusCode = 500;
      outgoing.end(String(error));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing server address");
  origin = `http://127.0.0.1:${address.port}`;
});

it("openapi.rate-limit-accuracy-boundary", async () => {
  const user = await db.user.create({
    data: { email: `${crypto.randomUUID()}@limiter.test` },
  });
  const token = crypto.randomUUID();
  await db.session.create({
    data: {
      userId: user.id,
      sessionToken: token,
      expires: new Date(Date.now() + 3600_000),
    },
  });
  const context = await getBetterAuthInstance().$context;
  const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`;
  try {
    for (const mode of ["limited", "unavailable"] as const) {
      rateLimitMode = mode;
      budgetCalls.length = 0;
      const denied = await fetch(`${origin}/api/workspace/todos`, {
        method: "POST",
        headers: { cookie, origin, "content-type": "application/json" },
        body: JSON.stringify({ title: "Do not persist this mutation" }),
      });
      expect(denied.status).toBe(mode === "limited" ? 429 : 503);
      expect(denied.headers.get("retry-after")).toBe("60");
      for (const name of denied.headers.keys())
        expect(name).not.toMatch(
          /(?:rate.?limit.*(?:remaining|reset|quota)|quota)/i,
        );
      expect(Object.keys(await denied.json())).toEqual(["error"]);
      expect(budgetCalls).toHaveLength(1);
      expect(await db.todo.count({ where: { userId: user.id } })).toBe(0);

      // HTTP POST does not imply a domain mutation: these utility reads and
      // browser preference cookies are independent of the authenticated budget.
      const section = await db.section.findFirstOrThrow({
        where: { semesterId: { not: null }, retiredAt: null },
      });
      const utilities = [
        {
          path: "/api/account/preferences",
          body: { locale: "en-us" },
          authenticated: false,
        },
        {
          path: "/api/catalog/sections/match-codes",
          body: { codes: [section.code], semesterId: section.semesterId },
          authenticated: false,
        },
        {
          path: "/api/workspace/subscriptions/query",
          body: { sectionIds: [section.id], semesterId: section.semesterId },
          authenticated: true,
        },
      ];
      for (const utility of utilities) {
        budgetCalls.length = 0;
        const response = await fetch(`${origin}${utility.path}`, {
          method: "POST",
          headers: {
            ...(utility.authenticated ? { cookie } : {}),
            origin,
            "content-type": "application/json",
          },
          body: JSON.stringify(utility.body),
        });
        const body = await response.text();
        expect(response.status, `${utility.path}: ${body}`).toBe(200);
        expect(budgetCalls).toEqual([]);
      }
      budgetCalls.length = 0;
      const session = await fetch(`${origin}/api/auth/get-session`, {
        headers: { cookie },
      });
      expect(session.status, await session.clone().text()).toBe(200);
      expect((await session.json()).user.id).toBe(user.id);
      expect(budgetCalls).toEqual([]);
    }
    const auth = await getBetterAuthInstance().$context;
    expect(auth.options.rateLimit?.enabled).not.toBe(false);
  } finally {
    rateLimitMode = undefined;
    await db.user.delete({ where: { id: user.id } });
  }
});
afterAll(async () => {
  setCalendarExportRebuildSenderForTest();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await Promise.all([
    db.$disconnect(),
    authPrisma.$disconnect(),
    prisma.$disconnect(),
  ]);
});

it("openapi.session-and-bearer", async () => {
  const users: string[] = [];
  const clientId = `rest-principal-${crypto.randomUUID()}`;
  const scopes = [
    "workspace.todo:read",
    "workspace.todo:write",
    "account.client-activity:read",
  ];
  await db.oAuthClient.create({
    data: {
      clientId,
      name: "Principal contract",
      scopes,
      redirectUris: ["https://client.example/callback"],
    },
  });
  async function owner(isAdmin = false) {
    const user = await db.user.create({
      data: { isAdmin, email: `${crypto.randomUUID()}@rest-principal.test` },
    });
    users.push(user.id);
    const todo = await db.todo.create({
      data: { userId: user.id, title: `Private ${user.id}` },
    });
    const sessionToken = crypto.randomUUID();
    await db.session.create({
      data: {
        userId: user.id,
        sessionToken,
        expires: new Date(Date.now() + 3600_000),
      },
    });
    const context = await getBetterAuthInstance().$context;
    const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${sessionToken}.${await makeSignature(sessionToken, context.secret)}`)}`;
    const consent = await db.oAuthConsent.create({
      data: { userId: user.id, clientId, scopes },
    });
    return { user, todo, cookie, consent };
  }
  try {
    const alice = await owner();
    const bob = await owner();
    const admin = await owner(true);
    async function bearer(
      actor: typeof alice,
      overrides: Partial<
        Parameters<typeof signResourceBoundOAuthAccessToken>[0]
      > = {},
    ) {
      const issuedAt = Math.floor(Date.now() / 1000);
      const token = await signResourceBoundOAuthAccessToken({
        clientId,
        userId: actor.user.id,
        grantId: actor.consent.grantId,
        scopes,
        resources: getOAuthRestAudienceUrls(),
        issuedAt,
        expiresAt: issuedAt + 300,
        ...overrides,
      });
      if (!token) throw new Error("Expected signed access token");
      return `Bearer ${token}`;
    }
    const aliceBearer = await bearer(alice);
    const bobBearer = await bearer(bob);
    const adminBearer = await bearer(admin);
    for (const [headers, expected] of [
      [{ cookie: alice.cookie }, alice],
      [{ authorization: aliceBearer }, alice],
      [{ cookie: alice.cookie, authorization: bobBearer }, bob],
      [{ cookie: admin.cookie }, admin],
    ] as const) {
      const response = await fetch(`${origin}/api/workspace/todos`, {
        headers,
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.todos.map((row: { id: string }) => row.id)).toEqual([
        expected.todo.id,
      ]);
    }
    const invalidHeaders: Record<string, string>[] = [
      {},
      { authorization: "Bearer malformed" },
      { authorization: "Bearer malformed", cookie: alice.cookie },
      {
        authorization: await bearer(alice, {
          scopes: ["account.client-activity:read"],
        }),
      },
      {
        authorization: await bearer(alice, {
          resources: ["http://localhost:3000/api/mcp"],
        }),
      },
      {
        authorization: await bearer(alice, {
          resources: ["http://localhost:3000/api/graphql"],
        }),
      },
      {
        authorization: await bearer(alice, {
          expiresAt: Math.floor(Date.now() / 1000) - 120,
        }),
      },
      { authorization: await bearer(alice, { grantId: crypto.randomUUID() }) },
    ];
    for (const headers of invalidHeaders) {
      const response = await fetch(`${origin}/api/workspace/todos`, {
        headers,
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
    }
    const patch = (id: string, headers: Record<string, string>) =>
      fetch(`${origin}/api/workspace/todos/${id}`, {
        method: "PATCH",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });
    for (const headers of [
      { cookie: alice.cookie },
      { authorization: aliceBearer },
    ] as Record<string, string>[]) {
      const response = await patch(alice.todo.id, headers);
      expect(response.status).toBe(200);
      await response.text();
    }
    for (const headers of [
      { cookie: bob.cookie },
      { authorization: bobBearer },
      { cookie: admin.cookie },
      { authorization: adminBearer },
    ] as Record<string, string>[]) {
      const response = await patch(alice.todo.id, headers);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Not found" });
    }
    const readOnly = await patch(alice.todo.id, {
      authorization: await bearer(alice, { scopes: ["workspace.todo:read"] }),
    });
    expect(readOnly.status).toBe(401);
    await readOnly.text();
    for (const [headers, status] of [
      [{ cookie: admin.cookie }, 200],
      [{ cookie: alice.cookie }, 401],
      [{ authorization: adminBearer }, 401],
      [{ authorization: adminBearer, cookie: admin.cookie }, 401],
    ] as const) {
      const response = await fetch(`${origin}/api/admin/users?pageSize=1`, {
        headers,
      });
      expect(response.status).toBe(status);
      await response.text();
    }
    for (const [headers, status] of [
      [{ cookie: alice.cookie }, 401],
      [{ authorization: aliceBearer }, 200],
    ] as const) {
      const response = await fetch(`${origin}/api/account/client-activity`, {
        headers,
      });
      expect(response.status).toBe(status);
      await response.text();
    }
    for (const headers of [
      { cookie: alice.cookie },
      { authorization: aliceBearer },
    ] as Record<string, string>[]) {
      const response = await fetch(
        `${origin}/api/ingestion/publications/batches`,
        {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: "{}",
        },
      );
      expect(response.status).toBe(401);
      await response.text();
    }
    const sensitive = await fetch(`${origin}/api/auth/passkey/update-passkey`, {
      method: "POST",
      headers: {
        authorization: aliceBearer,
        origin,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        id: "missing-credential",
        name: "Cannot authorize with bearer",
      }),
    });
    expect(sensitive.status).toBe(401);
    await sensitive.text();
    await db.oAuthConsent.delete({ where: { id: alice.consent.id } });
    const revoked = await fetch(`${origin}/api/workspace/todos`, {
      headers: { authorization: aliceBearer, cookie: alice.cookie },
    });
    expect(revoked.status).toBe(401);
    await revoked.text();
    const unchanged = await db.todo.findUniqueOrThrow({
      where: { id: alice.todo.id },
    });
    expect(unchanged).toMatchObject({
      userId: alice.user.id,
      title: alice.todo.title,
      completed: true,
    });
  } finally {
    await db.oAuthClient.delete({ where: { clientId } });
    await db.user.deleteMany({ where: { id: { in: users } } });
  }
});

it("openapi.state-setting-status", async () => {
  const marker = crypto.randomUUID();
  const user = await db.user.create({
    data: { email: `${marker}@state-setting.test` },
  });
  const seed = await db.section.findFirstOrThrow({
    where: { retiredAt: null, semesterId: { not: null } },
  });
  const section = await db.section.create({
    data: {
      jwId: 1_400_000_000 + Math.floor(Math.random() * 100_000_000),
      code: `STATE.${marker.slice(0, 8)}`,
      courseId: seed.courseId,
      semesterId: seed.semesterId,
    },
  });
  const homework = await db.homework.create({
    data: { sectionId: section.id, title: marker, createdById: user.id },
  });
  const comment = await db.comment.create({
    data: { sectionId: section.id, body: marker, userId: user.id },
  });
  const organizer = await db.youngOrganizer.create({
    data: { name: marker, normalizedName: marker },
  });
  const event = await db.youngEvent.create({
    data: {
      youngId: marker,
      name: marker,
      organizerId: organizer.id,
      isActive: true,
      rawJson: {},
    },
  });
  const notification = await db.youngNotification.create({
    data: {
      userId: user.id,
      kind: "event",
      title: marker,
      body: marker,
      dedupeKey: marker,
    },
  });
  const todo = await db.todo.create({
    data: { userId: user.id, title: marker },
  });
  const token = crypto.randomUUID();
  await db.session.create({
    data: {
      userId: user.id,
      sessionToken: token,
      expires: new Date(Date.now() + 3600_000),
    },
  });
  const context = await getBetterAuthInstance().$context;
  const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`;
  const slug = USTC_CATALOG_LINKS[0].slug;
  const cases = [
    {
      path: "/api/community/descriptions",
      body: {
        targetType: "section",
        sectionJwId: section.jwId,
        content: "State setting description",
      },
      count: () => db.description.count({ where: { sectionId: section.id } }),
    },
    {
      path: "/api/workspace/bus-preferences",
      body: { showDepartedTrips: true },
      count: () =>
        db.busUserPreference.count({
          where: { userId: user.id, showDepartedTrips: true },
        }),
    },
    {
      path: "/api/workspace/link-pins",
      form: true,
      body: { slug, action: "pin", returnTo: "/" },
      count: () =>
        db.workspaceLinkPin.count({ where: { userId: user.id, slug } }),
    },
    {
      path: "/api/workspace/link-pins/batch",
      body: { items: [{ slug, action: "pin" }] },
      count: () =>
        db.workspaceLinkPin.count({ where: { userId: user.id, slug } }),
    },
    {
      path: "/api/workspace/subscriptions",
      method: "PATCH",
      body: { sectionIds: [section.id] },
      count: () =>
        db.userSectionSubscription.count({
          where: { userId: user.id, sectionId: section.id },
        }),
    },
    {
      path: "/api/workspace/subscriptions/batch",
      body: {
        sectionIds: [section.id],
        action: "add",
        semesterId: section.semesterId,
      },
      count: () =>
        db.userSectionSubscription.count({
          where: { userId: user.id, sectionId: section.id },
        }),
    },
    {
      path: "/api/workspace/subscriptions/import-codes",
      body: { codes: [section.code], semesterId: section.semesterId },
      count: () =>
        db.userSectionSubscription.count({
          where: { userId: user.id, sectionId: section.id },
        }),
    },
    {
      path: `/api/workspace/subscriptions/${section.jwId}`,
      declared: "/api/workspace/subscriptions/{jwId}",
      method: "PATCH",
      body: { kind: "regular" },
      count: () =>
        db.userSectionSubscription.count({
          where: { userId: user.id, sectionId: section.id, kind: "regular" },
        }),
    },
    {
      path: `/api/community/comments/${comment.id}/reactions`,
      declared: "/api/community/comments/{id}/reactions",
      body: { type: "heart" },
      count: () =>
        db.commentReaction.count({
          where: { userId: user.id, commentId: comment.id, type: "heart" },
        }),
    },
    {
      path: `/api/workspace/homeworks/${homework.id}/completion`,
      declared: "/api/workspace/homeworks/{id}/completion",
      method: "PUT",
      body: { completed: true },
      count: () =>
        db.homeworkCompletion.count({
          where: { userId: user.id, homeworkId: homework.id },
        }),
    },
    {
      path: "/api/workspace/homeworks/completions",
      method: "PUT",
      body: { items: [{ homeworkId: homework.id, completed: true }] },
      count: () =>
        db.homeworkCompletion.count({
          where: { userId: user.id, homeworkId: homework.id },
        }),
    },
    {
      path: `/api/workspace/todos/${todo.id}`,
      declared: "/api/workspace/todos/{id}",
      method: "PATCH",
      body: { completed: true },
      count: () =>
        db.todo.count({
          where: { userId: user.id, id: todo.id, completed: true },
        }),
    },
    {
      path: "/api/workspace/todos/batch",
      method: "PATCH",
      body: { items: [{ todoId: todo.id, completed: true }] },
      count: () =>
        db.todo.count({
          where: { userId: user.id, id: todo.id, completed: true },
        }),
    },
    {
      path: `/api/workspace/young-event-subscriptions/${event.youngId}`,
      declared: "/api/workspace/young-event-subscriptions/{youngId}",
      method: "PUT",
      body: { subscribed: true },
      count: () =>
        db.userYoungEventSubscription.count({
          where: { userId: user.id, youngId: event.youngId },
        }),
    },
    {
      path: `/api/workspace/young-organizer-subscriptions/${organizer.id}`,
      declared: "/api/workspace/young-organizer-subscriptions/{organizerId}",
      method: "PUT",
      body: { subscribed: true },
      count: () =>
        db.userYoungOrganizerSubscription.count({
          where: { userId: user.id, organizerId: organizer.id },
        }),
    },
    {
      path: `/api/workspace/young-notifications/${notification.id}/read`,
      declared: "/api/workspace/young-notifications/{id}/read",
      body: {},
      count: () =>
        db.youngNotification.count({
          where: {
            userId: user.id,
            id: notification.id,
            readAt: { not: null },
          },
        }),
    },
  ];
  try {
    for (const item of cases) {
      const method = item.method ?? "POST";
      const path = item.declared ?? item.path;
      const operation = (
        openapi.paths as Record<
          string,
          Record<string, { responses: Record<string, unknown> }>
        >
      )[path][method.toLowerCase()];
      expect(operation.responses, path).toHaveProperty("200");
      expect(operation.responses, path).not.toHaveProperty("201");
      for (const repeat of [0, 1]) {
        const response = await fetch(`${origin}${item.path}`, {
          method,
          headers: {
            cookie,
            origin,
            accept: "application/json",
            "content-type": item.form
              ? "application/x-www-form-urlencoded"
              : "application/json",
          },
          body: item.form
            ? new URLSearchParams(
                Object.entries(item.body).map(([key, value]) => [
                  key,
                  String(value),
                ]),
              )
            : JSON.stringify(item.body),
          redirect: "manual",
        });
        const body = await response.text();
        expect(
          response.status,
          `${method} ${path} attempt${repeat}: ${body}`,
        ).toBe(200);
        expect(await item.count(), path).toBe(1);
      }
    }
  } finally {
    await db.auditLog.deleteMany({ where: { userId: user.id } });
    await db.section.delete({ where: { id: section.id } });
    await db.userYoungEventSubscription.deleteMany({
      where: { userId: user.id },
    });
    await db.userYoungOrganizerSubscription.deleteMany({
      where: { userId: user.id },
    });
    await db.youngEvent.delete({ where: { id: event.id } });
    await db.youngOrganizer.delete({ where: { id: organizer.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});

it("openapi.rest-batch-unique-targets", async () => {
  const user = await db.user.create({
    data: { email: `${crypto.randomUUID()}@batch.test` },
  });
  const token = crypto.randomUUID();
  await db.session.create({
    data: {
      userId: user.id,
      sessionToken: token,
      expires: new Date(Date.now() + 3600_000),
    },
  });
  const context = await getBetterAuthInstance().$context;
  const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`;
  const todo = await db.todo.create({
    data: {
      userId: user.id,
      title: "batch target remains unchanged",
      completed: false,
    },
  });
  const contracts = [
    {
      path: "/api/workspace/todos/batch",
      method: "PATCH",
      body: (ids: string[]) => ({
        items: ids.map((todoId, index) => ({ todoId, completed: index === 0 })),
      }),
    },
    {
      path: "/api/workspace/todos/batch",
      method: "DELETE",
      body: (ids: string[]) => ({ ids }),
    },
    {
      path: "/api/workspace/homeworks/completions",
      method: "PUT",
      body: (ids: string[]) => ({
        items: ids.map((homeworkId, index) => ({
          homeworkId,
          completed: index === 0,
        })),
      }),
    },
    {
      path: "/api/community/comments/batch",
      method: "DELETE",
      body: (ids: string[]) => ({ ids }),
    },
  ];
  try {
    for (const contract of contracts) {
      for (const ids of [
        [todo.id, todo.id],
        [todo.id, ` ${todo.id} `],
      ]) {
        const response = await fetch(`${origin}${contract.path}`, {
          method: contract.method,
          headers: { cookie, origin, "content-type": "application/json" },
          body: JSON.stringify(contract.body(ids)),
        });
        expect(response.status, `${contract.method} ${contract.path}`).toBe(
          400,
        );
        expect(await response.json()).toEqual({
          error: contract.path.includes("homeworks")
            ? "Invalid completion batch payload"
            : "Invalid batch payload",
        });
        expect(
          await db.todo.findUniqueOrThrow({ where: { id: todo.id } }),
        ).toEqual(todo);
      }
      // Distinct targets pass validation and return actual per-item domain outcomes.
      const response = await fetch(`${origin}${contract.path}`, {
        method: contract.method,
        headers: { cookie, origin, "content-type": "application/json" },
        body: JSON.stringify(
          contract.body([crypto.randomUUID(), crypto.randomUUID()]),
        ),
      });
      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        results: Array<{ success: boolean }>;
      };
      expect(payload.results).toHaveLength(2);
      expect(payload.results.every((item) => item.success === false)).toBe(
        true,
      );
    }
  } finally {
    await db.user.delete({ where: { id: user.id } });
  }
});
