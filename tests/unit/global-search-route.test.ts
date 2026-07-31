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
    searchGloballyMock.mockReset();
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
    expect(searchGloballyMock).toHaveBeenCalledWith(
      expect.objectContaining({
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
      new Request("https://life.example/api/search?q=math&locale=en-us"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(searchGloballyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
      }),
    );
  });
});
