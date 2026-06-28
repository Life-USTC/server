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

describe("认证提供方路由", () => {
  it("优先使用 redirectTo 而非 callbackUrl", () => {
    expect(
      resolveAuthRedirectTarget({
        redirectTo: "/dashboard",
        callbackUrl: "/settings",
      }),
    ).toBe("/dashboard");
  });

  it("当重定向目标为外部时回退", () => {
    expect(
      resolveAuthRedirectTarget(
        {
          redirectTo: "https://attacker.example",
          callbackUrl: "//attacker.example",
        },
        "/settings",
      ),
    ).toBe("/settings");
  });

  it("构建登录页 callback URL", () => {
    expect(buildSignInPageUrl("/oauth/authorize?client_id=test")).toBe(
      "/signin?callbackUrl=%2Foauth%2Fauthorize%3Fclient_id%3Dtest",
    );
  });

  it("从路径和查询构建当前页 callback URL", () => {
    expect(
      buildCurrentPathCallbackUrl(
        "/sections/123",
        new URLSearchParams({ tab: "homeworks", comment: "new" }),
      ),
    ).toBe("/sections/123?tab=homeworks&comment=new");
    expect(buildCurrentPathCallbackUrl("/courses/456")).toBe("/courses/456");
  });

  it("根据解析后的目标构建登录重定向", () => {
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

  it("按运行时行为分类认证提供方", () => {
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

  it("保持登录提供方顺序稳定", () => {
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
