import { afterEach, describe, expect, it, vi } from "vitest";

const { searchGloballyMock, observedRouteMock } = vi.hoisted(() => ({
  searchGloballyMock: vi.fn(),
  observedRouteMock: vi.fn(
    (handler: (request: Request) => Response | Promise<Response>) => handler,
  ),
}));

vi.mock("@/lib/log/api-observability", () => ({
  observedApiRoute: observedRouteMock,
}));

vi.mock("@/features/search/server/global-search-service", () => ({
  searchGlobally: searchGloballyMock,
}));

vi.mock("@/lib/auth/api-auth", () => ({
  resolveSessionUserId: vi.fn(),
}));

function clearPublicRuntimeCache() {
  delete (
    globalThis as typeof globalThis & {
      __lifeUstcPublicRuntimeCache?: unknown;
    }
  ).__lifeUstcPublicRuntimeCache;
}

describe("global search route", () => {
  afterEach(() => {
    vi.clearAllMocks();
    clearPublicRuntimeCache();
    vi.resetModules();
  });

  it("serves trusted Demo before ordinary auth, queries and durable observations", async () => {
    const { GET } = await import("@/routes/api/search/+server");
    const { resolveSessionUserId } = await import("@/lib/auth/api-auth");
    const request = new Request(
      "https://life.example/api/search?q=algebra&scope=workspace&locale=en-us",
    );
    const response = await GET({
      request,
      locals: {
        demo: { fixtureVersion: "workspace-v1", expiresAt: 1_800_000_000_000 },
      },
    } as unknown as Parameters<typeof GET>[0]);
    expect(response.status).toBe(200);
    expect(
      (await response.json()).groups.map(
        (group: { type: string }) => group.type,
      ),
    ).toEqual(["sections", "courses", "homeworks", "todos"]);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "no-store",
    );
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(response.headers.get("X-Robots-Tag")).toBe(
      "noindex, nofollow, noarchive",
    );
    expect(searchGloballyMock).not.toHaveBeenCalled();
    expect(resolveSessionUserId).not.toHaveBeenCalled();
    expect(observedRouteMock).not.toHaveBeenCalled();
  });

  it("keeps Demo query aliases, locale, limits and validation identical and private", async () => {
    const { getDemoGlobalSearchRoute } = await import(
      "@/lib/api/routes/global-search"
    );
    const read = (params: URLSearchParams) =>
      getDemoGlobalSearchRoute(
        new Request(`https://life.example/api/search?${params}`),
      );
    const aliased = read(
      new URLSearchParams({
        query: "  algebra  ",
        locale: "en-us",
        scope: "workspace",
        limit: "1",
      }),
    );
    expect(
      (await aliased.json()).groups.map(
        (group: { items: unknown[] }) => group.items.length,
      ),
    ).toEqual([1, 1, 1, 1]);
    expect(
      await read(new URLSearchParams({ q: "", query: "algebra" })).json(),
    ).toEqual({ query: "", groups: [] });
    for (const query of ["?", "x".repeat(200), "  xx  "])
      expect(read(new URLSearchParams({ q: query })).status).toBe(200);
    const invalidParams: Record<string, string>[] = [
      { q: "x".repeat(201) },
      { limit: "0" },
      { limit: "26" },
      { limit: "1.5" },
      { limit: "NaN" },
      { scope: "private" },
      { locale: "invalid" },
    ];
    for (const params of invalidParams) {
      const response = read(new URLSearchParams(params));
      expect(response.status).toBe(400);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
        "no-store",
      );
    }
    expect(
      read(
        new URLSearchParams({
          q: " x ",
          limit: "25",
          scope: "catalog",
          locale: "zh-cn",
        }),
      ).status,
    ).toBe(200);
  });

  it("returns public cache headers for anonymous search", async () => {
    const { resolveSessionUserId } = await import("@/lib/auth/api-auth");
    vi.mocked(resolveSessionUserId).mockResolvedValue(null);
    searchGloballyMock.mockResolvedValue({ query: "math", groups: [] });

    const { getGlobalSearchRoute } = await import(
      "@/lib/api/routes/global-search"
    );
    const response = await getGlobalSearchRoute(
      new Request("https://life.example/api/search?q=math&locale=en-us"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=0, s-maxage=120, stale-while-revalidate=300",
    );
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "public, max-age=120, stale-while-revalidate=300",
    );
    expect(response.headers.get("Cache-Tag")).toBe("catalog");
    expect(response.headers.get("Vary")).toBeNull();
    expect(resolveSessionUserId).not.toHaveBeenCalled();
    expect(searchGloballyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "en-us",
        origin: "https://life.example",
        query: "math",
        userId: null,
      }),
    );
  });

  it("returns private cache headers for signed-in search", async () => {
    const { resolveSessionUserId } = await import("@/lib/auth/api-auth");
    vi.mocked(resolveSessionUserId).mockResolvedValue("user-1");
    searchGloballyMock.mockResolvedValue({ query: "math", groups: [] });

    const { getGlobalSearchRoute } = await import(
      "@/lib/api/routes/global-search"
    );
    const response = await getGlobalSearchRoute(
      new Request(
        "https://life.example/api/search?q=math&locale=en-us&scope=workspace",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(searchGloballyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
      }),
    );
  });

  it("keeps workspace scope private when authentication is stale", async () => {
    const { resolveSessionUserId } = await import("@/lib/auth/api-auth");
    vi.mocked(resolveSessionUserId).mockResolvedValue(null);
    searchGloballyMock.mockResolvedValue({ query: "math", groups: [] });

    const { getGlobalSearchRoute } = await import(
      "@/lib/api/routes/global-search"
    );
    const response = await getGlobalSearchRoute(
      new Request(
        "https://life.example/api/search?q=math&locale=en-us&scope=workspace",
      ),
    );

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(searchGloballyMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null }),
    );
  });

  it("account.client-activity bearer cannot personalize workspace search or read Todos", async () => {
    const { resolveSessionUserId } = await import("@/lib/auth/api-auth");
    vi.mocked(resolveSessionUserId).mockResolvedValue(null);
    searchGloballyMock.mockResolvedValue({ query: "private", groups: [] });

    const { getGlobalSearchRoute } = await import(
      "@/lib/api/routes/global-search"
    );
    const request = new Request(
      "https://life.example/api/search?q=private&locale=en-us&scope=workspace",
      {
        headers: { authorization: "Bearer account-activity-token" },
      },
    );
    const response = await getGlobalSearchRoute(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(resolveSessionUserId).toHaveBeenCalledWith(request);
    expect(searchGloballyMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null }),
    );
  });

  it("never authenticates or personalizes the public catalog scope", async () => {
    const { resolveSessionUserId } = await import("@/lib/auth/api-auth");
    vi.mocked(resolveSessionUserId).mockResolvedValue("user-1");
    searchGloballyMock.mockResolvedValue({ query: "math", groups: [] });

    const { getGlobalSearchRoute } = await import(
      "@/lib/api/routes/global-search"
    );
    const response = await getGlobalSearchRoute(
      new Request("https://life.example/api/search?q=math&locale=zh-cn"),
    );

    expect(response.headers.get("Cache-Control")).toContain("public");
    expect(resolveSessionUserId).not.toHaveBeenCalled();
    expect(searchGloballyMock).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "zh-cn", userId: null }),
    );
  });

  it("caches omitted-locale public responses using the canonical locale", async () => {
    const { resolveSessionUserId } = await import("@/lib/auth/api-auth");
    searchGloballyMock.mockResolvedValue({ query: "math", groups: [] });

    const { getGlobalSearchRoute } = await import(
      "@/lib/api/routes/global-search"
    );
    const response = await getGlobalSearchRoute(
      new Request("https://life.example/api/search?q=math", {
        headers: { Cookie: "NEXT_LOCALE=en-us" },
      }),
    );

    expect(response.headers.get("Cache-Control")).toContain("public");
    expect(resolveSessionUserId).not.toHaveBeenCalled();
    expect(searchGloballyMock).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "zh-cn", userId: null }),
    );
  });

  it("rejects invalid locale and scope before searching", async () => {
    const { resolveSessionUserId } = await import("@/lib/auth/api-auth");
    const { getGlobalSearchRoute } = await import(
      "@/lib/api/routes/global-search"
    );

    const invalidScope = await getGlobalSearchRoute(
      new Request(
        "https://life.example/api/search?q=math&locale=zh-cn&scope=all",
      ),
    );
    const invalidLocale = await getGlobalSearchRoute(
      new Request("https://life.example/api/search?q=math&locale=fr-fr"),
    );

    expect(invalidScope.status).toBe(400);
    expect(invalidLocale.status).toBe(400);
    expect(resolveSessionUserId).not.toHaveBeenCalled();
    expect(searchGloballyMock).not.toHaveBeenCalled();
  });

  it("rejects search queries longer than the catalog search bound", async () => {
    const { resolveSessionUserId } = await import("@/lib/auth/api-auth");
    const { getGlobalSearchRoute } = await import(
      "@/lib/api/routes/global-search"
    );

    const response = await getGlobalSearchRoute(
      new Request(
        `https://life.example/api/search?q=${"a".repeat(201)}&locale=zh-cn`,
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Search query must not exceed 200 characters",
    });
    expect(resolveSessionUserId).not.toHaveBeenCalled();
    expect(searchGloballyMock).not.toHaveBeenCalled();
  });
});
