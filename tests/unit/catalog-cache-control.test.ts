import type { Handle } from "@sveltejs/kit";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app-env", () => ({
  getOptionalTrimmedEnv: (name: string) =>
    name === "NODE_ENV" ? "development" : undefined,
  loadEnv: vi.fn(),
}));

// Avoid building a real better-auth instance when a request carries an auth
// signal; cache-control decisions only depend on the signal, not the session.
vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeadersWithResponseHeaders: async () => null,
}));

import { handle } from "@/hooks.server";

function htmlResponse(headers?: HeadersInit) {
  return new Response('<html lang="zh-CN"><body>catalog</body></html>', {
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
  });
}

function handleInput(
  resolve: Parameters<Handle>[0]["resolve"],
  input: {
    headers?: HeadersInit;
    method?: string;
    pathname?: string;
    routeId?: Parameters<Handle>[0]["event"]["route"]["id"];
  } = {},
) {
  const url = new URL(
    `https://life.example${input.pathname ?? "/catalog/sections/161022"}`,
  );
  const event: Parameters<Handle>[0]["event"] = {
    cookies: {
      delete: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(() => []),
      serialize: vi.fn(() => ""),
      set: vi.fn(),
    },
    fetch,
    getClientAddress: () => "127.0.0.1",
    isDataRequest: false,
    isRemoteRequest: false,
    isSubRequest: false,
    locals: {
      authUser: null,
      locale: "zh-cn",
      requestId: "",
    },
    params: {},
    platform: undefined,
    request: new Request(url, {
      headers: input.headers,
      method: input.method ?? "GET",
    }),
    route: { id: input.routeId ?? "/catalog/sections/[jwId]" },
    setHeaders: vi.fn(),
    tracing: undefined,
    url,
  } as unknown as Parameters<Handle>[0]["event"];
  return { event, resolve };
}

describe("catalog page cache control", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lets the CDN briefly cache anonymous catalog pages", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});

    const response = await handle(handleInput(async () => htmlResponse()));

    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=0, stale-while-revalidate=300",
    );
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "public, max-age=60, stale-while-revalidate=300",
    );
    expect(response.headers.get("Vary")).toBe("Accept-Language, Cookie");
  });

  it("keeps authenticated catalog pages private and uncacheable", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});

    const response = await handle(
      handleInput(async () => htmlResponse(), {
        headers: { cookie: "better-auth.session_token=token-value" },
      }),
    );

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "no-store",
    );
  });

  it("keeps non-catalog pages on the no-store default", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});

    const response = await handle(
      handleInput(async () => htmlResponse(), {
        pathname: "/account/sign-in",
        routeId: "/account/sign-in",
      }),
    );

    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBeNull();
  });

  it("never overrides an explicit Cache-Control from the route", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});

    const response = await handle(
      handleInput(async () =>
        htmlResponse({ "Cache-Control": "public, max-age=300" }),
      ),
    );

    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
  });
});
