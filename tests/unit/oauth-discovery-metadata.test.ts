import { afterEach, describe, expect, it, vi } from "vitest";

describe("OAuth discovery metadata routes", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("adds discovery CORS headers to redirects without dropping Location", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://unit:unit@127.0.0.1:5432/unit");
    vi.stubEnv("AUTH_SECRET", "unit-test-secret");

    const { createDiscoveryRedirectRoute } = await import(
      "@/lib/oauth/discovery-metadata"
    );
    const route = createDiscoveryRedirectRoute(
      () =>
        new URL(
          "https://life.example/.well-known/oauth-authorization-server/api/auth",
        ),
    );

    const response = await route.GET(
      new Request(
        "https://life.example/.well-known/oauth-authorization-server",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://life.example/.well-known/oauth-authorization-server/api/auth",
    );
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "GET, OPTIONS",
    );
  });
});
