import type { Handle } from "@sveltejs/kit/hooks";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createDemoSession } from "@/features/demo/server/demo-session";
import { handle } from "@/hooks.server";
import {
  resolvePublicSsrMode,
  shouldRoutePublicSsrCache,
} from "@/lib/cloudflare/public-ssr-gateway";

const { session, persist } = vi.hoisted(() => ({
  session: vi.fn(),
  persist: vi.fn(),
}));
vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeadersWithResponseHeaders: session,
}));
vi.mock("@/lib/db/feature-event-store", () => ({
  writeObservabilityBatch: persist,
}));
let token: string;
beforeEach(async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("DEMO_ENABLED", "1");
  vi.stubEnv("AUTH_SECRET", "unit-demo-hook-secret");
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-24T01:00:00Z"));
  token = await createDemoSession();
});
afterEach(() => vi.useRealTimers());

async function request(
  path: string,
  method = "GET",
  headers: HeadersInit = {},
) {
  const url = new URL(path, "https://life.test");
  const locals = {} as App.Locals;
  const resolve = vi.fn(async () =>
    Response.json(
      { accepted: true },
      {
        headers: {
          "cache-control": "public, max-age=300",
          "x-life-public-navigation": "1",
        },
      },
    ),
  );
  const waitUntil = vi.fn();
  const response = await handle({
    event: {
      url,
      request: new Request(url, {
        method,
        headers: { cookie: `life-ustc.demo=${token}`, ...headers },
      }),
      params: {},
      route: { id: path },
      locals,
      cookies: { get: () => undefined },
      platform: { context: { waitUntil } },
    },
    resolve,
  } as unknown as Parameters<Handle>[0]);
  return { response, resolve, locals, waitUntil };
}

it.each([
  "/workspace/todos",
  "/workspace/todos/__data.json",
  "/api/workspace/todos",
  "/_internal/shell-bootstrap",
])("serves only demo locals and overrides caches at %s", async (path) => {
  const result = await request(path);
  expect(result.response.status).toBe(200);
  expect(result.locals.demo).toEqual({
    fixtureVersion: "todos-v1",
    expiresAt: Date.now() + 900_000,
  });
  expect(result.locals.authUser).toBeNull();
  expect(result.locals.publicSsr).toBe(false);
  expect(result.resolve).toHaveBeenCalledOnce();
  expect(result.response.headers.get("cache-control")).toBe(
    "private, no-store",
  );
  expect(result.response.headers.get("cloudflare-cdn-cache-control")).toBe(
    "no-store",
  );
  expect(result.response.headers.get("x-life-public-navigation")).toBeNull();
  expect(session).not.toHaveBeenCalled();
  expect(persist).not.toHaveBeenCalled();
  expect(result.waitUntil).not.toHaveBeenCalled();
});

it.each([
  ["POST", "/workspace/todos?/createTodo"],
  ["POST", "/api/workspace/todos"],
  ["PATCH", "/api/workspace/todos/real-id"],
  ["DELETE", "/api/workspace/todos/real-id"],
  ["POST", "/api/workspace/todos/batch"],
  ["GET", "/api/catalog/links/real-id/visit"],
  ["GET", "/admin/users"],
  ["POST", "/api/graphql"],
  ["POST", "/api/mcp"],
  ["GET", "/oauth/authorize"],
  ["POST", "/api/uploads"],
  ["GET", "/api/calendar/private.ics"],
  ["GET", "/catalog/courses"],
  ["GET", "/metrics"],
  ["HEAD", "/account/settings/profile"],
])(
  "rejects %s %s before session, resolver and persistent telemetry",
  async (method, path) => {
    const result = await request(path, method);
    expect(result.response.status).toBe(403);
    expect(result.resolve).not.toHaveBeenCalled();
    expect(session).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
    expect(result.waitUntil).not.toHaveBeenCalled();
    if (method === "HEAD") expect(await result.response.text()).toBe("");
  },
);

it("rejects invalid and mixed identities without resolving a real session", async () => {
  for (const [cookie, status] of [
    ["life-ustc.demo=invalid", 401],
    [`life-ustc.demo=${token}; better-auth.session_token=real`, 403],
  ] as const) {
    const result = await request("/api/workspace/todos", "GET", { cookie });
    expect(result.response.status).toBe(status);
    expect(result.resolve).not.toHaveBeenCalled();
    expect(session).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  }
});

it("bypasses both public cache admission gates even for an invalid cookie", () => {
  for (const path of [
    "/",
    "/account/sign-in",
    "/catalog/courses",
    "/catalog/links",
    "/privacy",
  ]) {
    const incoming = new Request(`https://life.test${path}`, {
      headers: { cookie: "life-ustc.demo=invalid" },
    });
    expect(resolvePublicSsrMode(incoming)).toBeNull();
    expect(shouldRoutePublicSsrCache(incoming, "page")).toBe(false);
  }
});

it("allows only same-origin locale-cookie updates", async () => {
  expect(
    (await request("/api/account/preferences", "POST")).response.status,
  ).toBe(403);
  const result = await request("/api/account/preferences", "POST", {
    origin: "https://life.test",
  });
  expect(result.response.status).toBe(200);
  expect(session).not.toHaveBeenCalled();
  expect(persist).not.toHaveBeenCalled();
});
