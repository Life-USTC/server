import { type APIRequestContext, expect } from "@playwright/test";
import { todosListResponseSchema } from "../../../../src/lib/api/schemas/misc-response-schema-core";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test } from "../../../e2e/utils/owned-worker";
import { createSignedDemoCookie } from "../../../shared/demo-token";

const secret = { "x-test-storage-secret": "local-test-storage-observer" };
const cookieHeader = (cookie: { name: string; value: string }) =>
  `${cookie.name}=${cookie.value}`;

async function databaseSnapshot(worker: IsolatedWorker) {
  const db = worker.database.owner;
  const tables = await db.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  const result: Record<string, unknown[]> = {};
  for (const { tablename } of tables) {
    const name = tablename.replaceAll('"', '""');
    result[tablename] = await db.$queryRawUnsafe(
      `SELECT row_to_json(t)::text AS row FROM "${name}" t ORDER BY row_to_json(t)::text`,
    );
  }
  return result;
}

async function enter(
  request: APIRequestContext,
  origin: string,
  headers: Record<string, string> = {},
) {
  const response = await request.post("/account/demo/enter", {
    headers: { ...headers, origin },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toBe("/workspace/todos");
  expect(response.headers()["set-cookie"]).toMatch(
    /life-ustc\.demo=.*HttpOnly/,
  );
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  await response.body();
  const cookie = (await request.storageState()).cookies.find(
    (cookie) => cookie.name === "life-ustc.demo",
  );
  expect(cookie).toBeDefined();
  if (!cookie) throw new Error("Demo entry did not set its cookie");
  return cookie;
}

test("demo production entry stays disabled without the explicit binding", {
  tag: "@Account/REST",
}, async ({ request, isolatedWorker, run }) => {
  await run(async () => {
    const before = await databaseSnapshot(isolatedWorker);
    for (const path of [
      "/account/demo/enter",
      "/account/%64emo/enter",
      "/account/demo/%65nter",
    ]) {
      const response = await request.post(path, {
        headers: { origin: isolatedWorker.origin },
        maxRedirects: 0,
      });
      expect(response.status()).toBe(404);
      expect(response.headers()["set-cookie"]).toBeUndefined();
      await response.body();
    }
    expect(await databaseSnapshot(isolatedWorker)).toEqual(before);
  });
});

test.describe("enabled demo", () => {
  test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });

  test("demo entry is explicit, same-origin and separate from real sessions", {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const actor = await isolatedWorker.createActor();
      const before = await databaseSnapshot(isolatedWorker);
      for (const headers of [
        {},
        { origin: "https://untrusted.test" },
        { origin: isolatedWorker.origin, cookie: cookieHeader(actor.cookie) },
      ] as Record<string, string>[]) {
        const response = await request.post("/account/demo/enter", {
          headers,
          maxRedirects: 0,
        });
        expect(response.status()).toBe(403);
        expect(response.headers()["set-cookie"]).toBeUndefined();
        await response.body();
      }
      for (const path of ["/account/%64emo/enter", "/account/demo/%65nter"]) {
        const response = await request.post(path, { maxRedirects: 0 });
        expect(response.status()).toBe(404);
        expect(response.headers()["set-cookie"]).toBeUndefined();
        await response.body();
      }
      const cookie = await enter(request, isolatedWorker.origin);
      const repeat = await request.post("/account/demo/enter", {
        headers: { origin: isolatedWorker.origin },
        maxRedirects: 0,
      });
      expect(repeat.status()).toBe(403);
      await repeat.body();
      const exit = await request.post("/account/demo/exit", {
        headers: {
          origin: isolatedWorker.origin,
          cookie: `${cookieHeader(cookie)}; ${cookieHeader(actor.cookie)}`,
        },
        maxRedirects: 0,
      });
      expect(exit.status()).toBe(303);
      expect(exit.headers().location).toBe("/account/sign-in");
      expect(exit.headers()["set-cookie"]).toMatch(/^life-ustc\.demo=;/);
      expect(exit.headers()["set-cookie"]).not.toContain("better-auth");
      await exit.body();
      expect(await databaseSnapshot(isolatedWorker)).toEqual(before);
      const own = await actor.request.get("/api/workspace/todos");
      expect(own.status()).toBe(200);
      await own.body();
    });
  });

  test("demo API preserves fixed samples, filters, counts and pagination", {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      await enter(request, isolatedWorker.origin);
      const response = await request.get("/api/workspace/todos", {
        headers: { "accept-language": "en-US" },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      todosListResponseSchema.parse(body);
      expect(body.counts).toEqual({ incomplete: 2, completed: 1, overdue: 1 });
      expect(
        body.todos.map((todo: { id: string; title: string }) => [
          todo.id,
          todo.title,
        ]),
      ).toEqual([
        ["demo-todo-reading", "Review linear algebra"],
        ["demo-todo-outline", "Organize course notes"],
        ["demo-todo-library", "Return library books"],
      ]);
      const filtered = await request.get(
        "/api/workspace/todos?completed=false&dueAfter=2026-09-24T00:00:00%2B08:00&page=1&pageSize=1",
      );
      expect(filtered.status()).toBe(200);
      const page = await filtered.json();
      todosListResponseSchema.parse(page);
      expect(page.data.map((todo: { id: string }) => todo.id)).toEqual([
        "demo-todo-outline",
      ]);
      expect(page.pagination).toEqual({
        page: 1,
        pageSize: 1,
        total: 1,
        totalPages: 1,
      });
      expect(page.meta.counts).toEqual({
        incomplete: 2,
        completed: 1,
        overdue: 1,
      });
      const empty = await request.get(
        "/api/workspace/todos?completed=true&priority=high",
      );
      expect((await empty.json()).todos).toEqual([]);
      const invalid = await request.get("/api/workspace/todos?pageSize=101");
      expect(invalid.status()).toBe(400);
      await invalid.body();
      const data = await request.get("/workspace/todos/__data.json");
      expect(data.status()).toBe(200);
      expect(await data.text()).toContain("demo-todo-reading");
      expect(data.headers()["x-life-public-navigation"]).toBeUndefined();
    });
  });

  test("demo requests cannot reach durable data or external side effects", {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const actor = await isolatedWorker.createActor();
      const todo = await isolatedWorker.database.owner.todo.create({
        data: { userId: actor.id, title: "Unrelated private task" },
      });
      const before = await databaseSnapshot(isolatedWorker);
      const id = crypto.randomUUID();
      const probePath = `/__test/community-effects?id=${id}`;
      const registered = await request.post(`${probePath}&io=1`, {
        headers: secret,
      });
      expect(registered.status()).toBe(201);
      await registered.body();
      try {
        const probeHeaders = {
          ...secret,
          "x-test-community-probe": id,
        };
        const cookie = await enter(
          request,
          isolatedWorker.origin,
          probeHeaders,
        );
        const headers = {
          ...probeHeaders,
          cookie: cookieHeader(cookie),
          origin: isolatedWorker.origin,
        };
        for (const [method, path] of [
          ["POST", "/workspace/todos?/createTodo"],
          ["POST", "/api/workspace/todos"],
          ["PATCH", `/api/workspace/todos/${todo.id}`],
          ["DELETE", `/api/workspace/todos/${todo.id}`],
          ["PATCH", "/api/workspace/todos/batch"],
          ["DELETE", "/api/workspace/todos/batch"],
          ["GET", "/api/catalog/links/resolve?slug=jw"],
          ["GET", "/api/workspace/uploads/private/download"],
          ["POST", "/api/workspace/uploads"],
          ["GET", "/api/calendar-feeds/private.ics"],
          ["GET", "/oauth/authorize"],
          ["POST", "/api/auth/oauth2/token"],
          ["GET", "/admin/users"],
          ["POST", "/api/graphql"],
          ["POST", "/api/mcp"],
          ["GET", "/catalog/courses"],
          ["POST", "/_internal/edge-cache/purge"],
        ]) {
          const response = await request.fetch(path, {
            method,
            headers,
            ...(method !== "GET"
              ? { data: { title: "Blocked", completed: true, ids: [todo.id] } }
              : {}),
            maxRedirects: 0,
          });
          expect(response.status(), `${method} ${path}`).toBe(403);
          expect(response.headers()["cache-control"]).toBe("private, no-store");
          expect(response.headers()["cloudflare-cdn-cache-control"]).toBe(
            "no-store",
          );
          expect(
            response.headers()["x-life-public-navigation"],
          ).toBeUndefined();
          await response.body();
        }
        for (const path of [
          "/workspace/todos",
          "/workspace/todos/__data.json",
          "/api/workspace/todos",
          "/_internal/shell-bootstrap",
        ]) {
          const response = await request.get(path, { headers });
          expect(response.status()).toBe(200);
          expect(await response.text()).not.toContain(todo.title);
        }
        const locale = await request.post("/api/account/preferences", {
          headers,
          data: { locale: "en-us" },
        });
        expect(locale.status()).toBe(200);
        await locale.body();
        const exit = await request.post("/account/demo/exit", {
          headers,
          maxRedirects: 0,
        });
        expect(exit.status()).toBe(303);
        expect(exit.headers().location).toBe("/account/sign-in");
        expect(exit.headers()["set-cookie"]).toMatch(/^life-ustc\.demo=;/);
        await exit.body();
        const collected = await request.get(probePath, { headers: secret });
        const effects = await collected.json();
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
        expect(await databaseSnapshot(isolatedWorker)).toEqual(before);
      } finally {
        const removed = await request.delete(probePath, { headers: secret });
        expect(removed.status()).toBe(204);
        await removed.body();
      }
    });
  });

  test("invalid and mixed demo cookies fail closed at the real Worker", {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const actor = await isolatedWorker.createActor();
      const valid = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000),
      });
      const expired = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000) - 901,
      });
      const old = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000),
        fixtureVersion: "todos-v0",
      });
      const before = await databaseSnapshot(isolatedWorker);
      for (const [cookie, status] of [
        ["life-ustc.demo=invalid", 401],
        [cookieHeader(expired), 401],
        [cookieHeader(old), 401],
        [`${cookieHeader(valid)}; ${cookieHeader(actor.cookie)}`, 403],
        [`${cookieHeader(valid)}; ${cookieHeader(valid)}`, 401],
      ] as const) {
        const response = await request.get("/api/workspace/todos", {
          headers: { cookie },
          maxRedirects: 0,
        });
        expect(response.status()).toBe(status);
        expect(response.headers()["cache-control"]).toBe("private, no-store");
        await response.body();
      }
      const html = await request.get("/workspace/todos", {
        headers: { cookie: cookieHeader(expired), accept: "text/html" },
        maxRedirects: 0,
      });
      expect(html.status()).toBe(303);
      expect(html.headers().location).toBe("/account/sign-in");
      expect(html.headers()["set-cookie"]).toMatch(/^life-ustc\.demo=;/);
      await html.body();
      expect(await databaseSnapshot(isolatedWorker)).toEqual(before);
    });
  });
});
