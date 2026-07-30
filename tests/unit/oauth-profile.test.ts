import { describe, expect, it } from "vitest";
import {
  getOidcAccountSubject,
  mapGithubProfileToUser,
  mapGoogleProfileToUser,
  mapOidcProfileToUser,
} from "@/lib/auth/oauth-profile";

describe("OAuth 档案映射", () => {
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
  });

  it("保留提供者提供的 OIDC 档案字段", () => {
    const profile = {
      sub: "abc",
      email: "student@example.com",
      email_verified: true,
      name: "Student Name",
      picture: "https://example.com/avatar.png",
    };

    expect(getOidcAccountSubject(profile)).toBe("abc");
    expect(mapOidcProfileToUser(profile)).toEqual({
      email: "student@example.com",
      name: "Student Name",
      image: "https://example.com/avatar.png",
      emailVerified: true,
    });
  });

  it("接受 OIDC 档案中的驼峰式邮箱验证字段", () => {
    expect(
      mapOidcProfileToUser({
        sub: "abc",
        email: "student@example.com",
        emailVerified: true,
      }).emailVerified,
    ).toBe(true);
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

  it("映射 GitHub 档案时不信任邮箱验证状态", () => {
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
  });

  it("仅在存在邮箱时映射 Google 邮箱验证状态", () => {
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

    expect(
      mapGoogleProfileToUser({
        sub: "google-user",
        email_verified: true,
      }).emailVerified,
    ).toBe(false);
  });
});
