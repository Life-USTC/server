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

describe("欢迎页重定向策略", () => {
  it("将资料不完整的已登录用户从普通页面重定向", () => {
    expect(shouldRedirect("/")).toBe(true);
    expect(shouldRedirect("/settings")).toBe(true);
  });

  it("允许资料补全页和 OAuth 授权页", () => {
    expect(shouldRedirect("/welcome")).toBe(false);
    expect(shouldRedirect("/signin")).toBe(false);
    expect(shouldRedirect("/oauth/authorize")).toBe(false);
  });

  it("不重定向 API、发现服务或静态资源请求", () => {
    expect(shouldRedirect("/api/me")).toBe(false);
    expect(shouldRedirect("/.well-known/openid-configuration")).toBe(false);
    expect(shouldRedirect("/_app/immutable/start.js")).toBe(false);
    expect(shouldRedirect("/llms.txt")).toBe(false);
    expect(shouldRedirect("/robots.txt")).toBe(false);
    expect(shouldRedirect("/sitemap.xml")).toBe(false);
  });

  it("按协议形态允许 OAuth 回调继续，而非测试路径", () => {
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

  it("不将仅含 state 的任意 URL 视为 OAuth 回调", () => {
    expect(shouldRedirect("/", "http://localhost:3000/?state=xyz")).toBe(true);
  });
});
