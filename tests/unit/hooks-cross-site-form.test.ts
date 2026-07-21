import { afterEach, describe, expect, it, vi } from "vitest";
import { crossSiteFormResponse } from "@/hooks.server";

function event(
  pathname = "/settings/profile",
  origin = "https://evil.example",
) {
  const url = new URL(`https://life.example${pathname}`);
  return {
    request: new Request(url, {
      method: "POST",
      headers: {
        accept: "application/json, */*",
        "content-type": "application/x-www-form-urlencoded",
        origin,
      },
      body: new URLSearchParams({ name: "Mallory" }),
    }),
    url,
  } as Parameters<typeof crossSiteFormResponse>[0];
}

describe("cross-site form protection", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects an untrusted cross-origin form request in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = crossSiteFormResponse(event());
    expect(response).not.toBeNull();
    if (!response)
      throw new Error("Expected the CSRF gate to reject the request");

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      message: "Cross-site POST form submissions are forbidden",
    });
  });

  it("allows same-origin and configured public origins", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://preview.example");

    expect(
      crossSiteFormResponse(event("/settings/profile", "https://life.example")),
    ).toBeNull();
    expect(
      crossSiteFormResponse(
        event("/settings/profile", "https://preview.example"),
      ),
    ).toBeNull();
  });

  it.each([
    "/api/auth/oauth2/token",
    "/api/auth/oauth2/device-authorization",
  ])("allows OAuth form CORS at %s", (pathname) => {
    vi.stubEnv("NODE_ENV", "production");

    expect(crossSiteFormResponse(event(pathname))).toBeNull();
  });
});
