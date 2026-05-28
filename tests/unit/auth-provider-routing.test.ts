import { describe, expect, it } from "vitest";
import {
  buildCurrentPathCallbackUrl,
  buildSignInPageUrl,
  buildSignInRedirectUrl,
  resolveAuthRedirectTarget,
} from "@/lib/auth/auth-routing";
import {
  getSignInProviderIds,
  resolveAuthProviderDecision,
} from "@/lib/auth/provider-ids";

describe("auth provider routing", () => {
  it("prefers redirectTo over callbackUrl", () => {
    expect(
      resolveAuthRedirectTarget({
        redirectTo: "/dashboard",
        callbackUrl: "/settings",
      }),
    ).toBe("/dashboard");
  });

  it("builds the sign-in page callback URL once", () => {
    expect(buildSignInPageUrl("/oauth/authorize?client_id=test")).toBe(
      "/signin?callbackUrl=%2Foauth%2Fauthorize%3Fclient_id%3Dtest",
    );
  });

  it("builds current-page callback URLs from path and query", () => {
    expect(
      buildCurrentPathCallbackUrl(
        "/sections/123",
        new URLSearchParams({ tab: "homeworks", comment: "new" }),
      ),
    ).toBe("/sections/123?tab=homeworks&comment=new");
    expect(buildCurrentPathCallbackUrl("/courses/456")).toBe("/courses/456");
  });

  it("builds sign-in redirects from the resolved destination", () => {
    expect(
      buildSignInRedirectUrl(
        {
          redirectTo: "/settings?tab=accounts",
          callbackUrl: "/ignored",
        },
        "/",
      ),
    ).toBe("/signin?callbackUrl=%2Fsettings%3Ftab%3Daccounts");
    expect(buildSignInRedirectUrl({}, "/admin/users?page=2")).toBe(
      "/signin?callbackUrl=%2Fadmin%2Fusers%3Fpage%3D2",
    );
  });

  it("classifies auth providers by runtime behavior", () => {
    expect(resolveAuthProviderDecision()).toEqual({ kind: "none" });
    expect(resolveAuthProviderDecision("oidc")).toEqual({
      kind: "oidc",
      providerId: "oidc",
    });
    expect(resolveAuthProviderDecision("dev-debug")).toEqual({
      kind: "debug",
      providerId: "dev-debug",
    });
    expect(resolveAuthProviderDecision("github")).toEqual({
      kind: "social",
      providerId: "github",
    });
  });

  it("keeps the sign-in provider order stable", () => {
    expect(getSignInProviderIds(false)).toEqual(["oidc", "github", "google"]);
    expect(getSignInProviderIds(true)).toEqual([
      "oidc",
      "github",
      "google",
      "dev-debug",
      "dev-admin",
    ]);
  });
});
