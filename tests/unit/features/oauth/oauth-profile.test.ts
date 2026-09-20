import { afterEach, describe, expect, it } from "vitest";
import {
  getOidcAccountSubject,
  mapGithubProfileToUser,
  mapGoogleProfileToUser,
  mapOidcProfileToUser,
} from "@/lib/auth/oauth-profile";
import {
  clearStagedSocialVerifiedEmails,
  consumeStagedSocialVerifiedEmail,
} from "@/lib/auth/social-verified-email-staging";

describe("OAuth 档案映射", () => {
  afterEach(() => {
    clearStagedSocialVerifiedEmails();
  });

  it("接受仅含 id 的稀疏 USTC OIDC 档案", () => {
    const profile = {
      id: "435",
      sub: "435",
      user_id: 435,
      emailVerified: false,
    };

    expect(getOidcAccountSubject(profile)).toBe("435");
    expect(mapOidcProfileToUser(profile)).toEqual({
      email: "oidc-435@users.local",
      name: "USTC User 435",
      image: undefined,
      emailVerified: false,
    });
    expect(consumeStagedSocialVerifiedEmail("oidc", "435")).toEqual({
      provider: "oidc",
      accountId: "435",
      email: null,
      emailVerified: false,
      name: "USTC User 435",
      image: null,
    });
  });

  it("忽略 passport fake_email 占位邮箱并回退到本地邮箱", () => {
    const profile = {
      sub: "812",
      user_id: 812,
      gid: "gid-812",
      fake_email: "fakegid+gid-812@example.com",
      fake_email_verified: true,
    };

    expect(mapOidcProfileToUser(profile)).toEqual({
      email: "oidc-812@users.local",
      name: "USTC User 812",
      image: undefined,
      emailVerified: false,
    });
  });

  it("USTC OIDC 始终使用本地邮箱，不信任上游 email 声明", () => {
    const profile = {
      sub: "abc",
      email: "student@example.com",
      email_verified: true,
      name: "Student Name",
      picture: "https://example.com/avatar.png",
    };

    expect(getOidcAccountSubject(profile)).toBe("abc");
    expect(mapOidcProfileToUser(profile)).toEqual({
      email: "oidc-abc@users.local",
      name: "Student Name",
      image: "https://example.com/avatar.png",
      emailVerified: false,
    });
  });

  it("使用第一个非空的档案显示名称", () => {
    expect(
      mapOidcProfileToUser({
        sub: "abc",
        name: " ",
        preferred_username: " student ",
        nickname: "ignored",
      }).name,
    ).toBe("student");
  });

  it("映射 GitHub 档案时暂存可发布邮箱", () => {
    expect(
      mapGithubProfileToUser({
        id: "octocat",
        email: "octocat@example.com",
        name: " Octo Cat ",
        login: "ignored",
        avatar_url: "https://example.com/octocat.png",
      }),
    ).toEqual({
      email: "octocat@example.com",
      name: "Octo Cat",
      image: "https://example.com/octocat.png",
      emailVerified: false,
    });
    expect(consumeStagedSocialVerifiedEmail("github", "octocat")).toEqual({
      provider: "github",
      accountId: "octocat",
      email: "octocat@example.com",
      emailVerified: true,
      name: "Octo Cat",
      image: "https://example.com/octocat.png",
    });
  });

  it("为隐藏的 GitHub 邮箱使用本地兜底邮箱", () => {
    expect(
      mapGithubProfileToUser({
        id: "octocat",
        login: "octocat",
        email: null,
      }),
    ).toEqual({
      email: "github-octocat@users.local",
      name: "octocat",
      image: undefined,
      emailVerified: false,
    });
    expect(consumeStagedSocialVerifiedEmail("github", "octocat")).toEqual({
      provider: "github",
      accountId: "octocat",
      email: null,
      emailVerified: false,
      name: "octocat",
      image: null,
    });
  });

  it("仅在邮箱已验证时暂存 Google 邮箱", () => {
    expect(
      mapGoogleProfileToUser({
        sub: "google-user",
        email: "student@example.com",
        email_verified: true,
        name: "Student",
        picture: "https://example.com/google.png",
      }),
    ).toEqual({
      email: "student@example.com",
      name: "Student",
      image: "https://example.com/google.png",
      emailVerified: true,
    });
    expect(consumeStagedSocialVerifiedEmail("google", "google-user")).toEqual({
      provider: "google",
      accountId: "google-user",
      email: "student@example.com",
      emailVerified: true,
      name: "Student",
      image: "https://example.com/google.png",
    });

    expect(
      mapGoogleProfileToUser({
        sub: "google-user",
        email: "unverified@example.com",
        email_verified: false,
      }).emailVerified,
    ).toBe(false);
    expect(consumeStagedSocialVerifiedEmail("google", "google-user")).toEqual({
      provider: "google",
      accountId: "google-user",
      email: null,
      emailVerified: false,
      name: null,
      image: null,
    });
  });
});
