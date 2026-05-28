import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getOAuthDebugMode,
  sanitizeOAuthRedirectLocation,
  summarizeOAuthRedirectUri,
} from "@/lib/log/oauth-debug";

describe("oauth debug logging", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses debug logging modes from env", () => {
    vi.stubEnv("OAUTH_DEBUG_LOGGING", "");
    expect(getOAuthDebugMode()).toBe("off");

    vi.stubEnv("OAUTH_DEBUG_LOGGING", " false ");
    expect(getOAuthDebugMode()).toBe("off");

    vi.stubEnv("OAUTH_DEBUG_LOGGING", "2");
    expect(getOAuthDebugMode()).toBe("verbose");

    vi.stubEnv("OAUTH_DEBUG_LOGGING", "VERBOSE");
    expect(getOAuthDebugMode()).toBe("verbose");

    vi.stubEnv("OAUTH_DEBUG_LOGGING", " verbose ");
    expect(getOAuthDebugMode()).toBe("verbose");

    vi.stubEnv("OAUTH_DEBUG_LOGGING", "1");
    expect(getOAuthDebugMode()).toBe("standard");
  });

  it("redacts sensitive redirect query values", () => {
    expect(
      sanitizeOAuthRedirectLocation(
        "/callback?code=secret&state=ok&access_token=token",
        "https://life.example.com/api/auth",
      ),
    ).toBe(
      "https://life.example.com/callback?code=%5BREDACTED%5D&state=ok&access_token=%5BREDACTED%5D",
    );
  });

  it("summarizes redirect URL shape without query values", () => {
    expect(
      summarizeOAuthRedirectUri(
        "https://client.example:8443/callback?state=ok&code=secret",
      ),
    ).toEqual({
      redirectOrigin: "https://client.example:8443",
      redirectHost: "client.example:8443",
      redirectHostname: "client.example",
      redirectPort: "8443",
      redirectPath: "/callback",
      redirectQueryKeys: ["code", "state"],
    });
  });

  it("keeps invalid redirect summaries explicit", () => {
    expect(summarizeOAuthRedirectUri("not a url")).toEqual({
      redirectOrigin: null,
      redirectHost: "invalid_redirect_uri",
      redirectHostname: null,
      redirectPort: null,
      redirectPath: null,
      redirectQueryKeys: [],
    });
  });
});
