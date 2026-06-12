import { describe, expect, it } from "vitest";
import { shouldRedirectIncompleteProfileToWelcome } from "@/lib/auth/auth-routing";

function shouldRedirect(path: string, url = `http://localhost:3000${path}`) {
  return shouldRedirectIncompleteProfileToWelcome({
    pathname: new URL(url).pathname,
    url: new URL(url),
    hasUser: true,
    hasCompleteProfile: false,
  });
}

describe("welcome redirect policy", () => {
  it("redirects incomplete signed-in users away from normal pages", () => {
    expect(shouldRedirect("/")).toBe(true);
    expect(shouldRedirect("/settings")).toBe(true);
  });

  it("allows profile completion and OAuth consent pages", () => {
    expect(shouldRedirect("/welcome")).toBe(false);
    expect(shouldRedirect("/signin")).toBe(false);
    expect(shouldRedirect("/oauth/authorize")).toBe(false);
  });

  it("does not redirect API, discovery, or static asset requests", () => {
    expect(shouldRedirect("/api/me")).toBe(false);
    expect(shouldRedirect("/.well-known/openid-configuration")).toBe(false);
    expect(shouldRedirect("/_app/immutable/start.js")).toBe(false);
    expect(shouldRedirect("/robots.txt")).toBe(false);
    expect(shouldRedirect("/sitemap.xml")).toBe(false);
  });

  it("allows OAuth callback continuations by protocol shape, not test path", () => {
    expect(
      shouldRedirect(
        "/e2e/oauth/callback",
        "http://localhost:3000/e2e/oauth/callback?code=abc&state=xyz",
      ),
    ).toBe(false);
    expect(
      shouldRedirect(
        "/custom/callback",
        "http://localhost:3000/custom/callback?error=access_denied&state=xyz",
      ),
    ).toBe(false);
  });

  it("does not treat arbitrary state-only URLs as OAuth callbacks", () => {
    expect(shouldRedirect("/", "http://localhost:3000/?state=xyz")).toBe(true);
  });
});
