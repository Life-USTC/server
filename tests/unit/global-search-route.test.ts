import { afterEach, describe, expect, it, vi } from "vitest";

const { searchGloballyMock } = vi.hoisted(() => ({
  searchGloballyMock: vi.fn(),
}));

vi.mock("@/features/search/server/global-search-service", () => ({
  searchGlobally: searchGloballyMock,
}));

vi.mock("@/lib/auth/api-auth", () => ({
  resolveApiUserId: vi.fn(),
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

  it("returns public cache headers for anonymous search", async () => {
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
    vi.mocked(resolveApiUserId).mockResolvedValue(null);
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
    expect(resolveApiUserId).not.toHaveBeenCalled();
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
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
    vi.mocked(resolveApiUserId).mockResolvedValue("user-1");
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
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
    vi.mocked(resolveApiUserId).mockResolvedValue(null);
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

  it("never authenticates or personalizes the public catalog scope", async () => {
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
    vi.mocked(resolveApiUserId).mockResolvedValue("user-1");
    searchGloballyMock.mockResolvedValue({ query: "math", groups: [] });

    const { getGlobalSearchRoute } = await import(
      "@/lib/api/routes/global-search"
    );
    const response = await getGlobalSearchRoute(
      new Request("https://life.example/api/search?q=math&locale=zh-cn"),
    );

    expect(response.headers.get("Cache-Control")).toContain("public");
    expect(resolveApiUserId).not.toHaveBeenCalled();
    expect(searchGloballyMock).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "zh-cn", userId: null }),
    );
  });

  it("uses the deterministic default locale for implicit private responses", async () => {
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
    searchGloballyMock.mockResolvedValue({ query: "math", groups: [] });

    const { getGlobalSearchRoute } = await import(
      "@/lib/api/routes/global-search"
    );
    const response = await getGlobalSearchRoute(
      new Request("https://life.example/api/search?q=math", {
        headers: { Cookie: "NEXT_LOCALE=en-us" },
      }),
    );

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(resolveApiUserId).not.toHaveBeenCalled();
    expect(searchGloballyMock).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "zh-cn", userId: null }),
    );
  });

  it("rejects invalid locale and scope before searching", async () => {
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
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
    expect(resolveApiUserId).not.toHaveBeenCalled();
    expect(searchGloballyMock).not.toHaveBeenCalled();
  });
});
