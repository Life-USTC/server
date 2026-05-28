import { describe, expect, it } from "vitest";
import {
  mapGithubProfileToUser,
  mapGoogleProfileToUser,
  mapOidcProfileToUser,
} from "@/lib/auth/oauth-profile";

describe("OAuth profile mapping", () => {
  it("accepts sparse USTC OIDC profiles with only an id", () => {
    expect(
      mapOidcProfileToUser({
        id: "435",
        sub: "435",
        user_id: 435,
        emailVerified: false,
      }),
    ).toEqual({
      id: "435",
      email: "oidc-435@users.local",
      name: "USTC User 435",
      image: undefined,
      emailVerified: false,
    });
  });

  it("preserves provider supplied OIDC profile fields when present", () => {
    expect(
      mapOidcProfileToUser({
        sub: "abc",
        email: "student@example.com",
        email_verified: true,
        name: "Student Name",
        picture: "https://example.com/avatar.png",
      }),
    ).toEqual({
      id: "abc",
      email: "student@example.com",
      name: "Student Name",
      image: "https://example.com/avatar.png",
      emailVerified: true,
    });
  });

  it("accepts camelCase email verification from OIDC profiles", () => {
    expect(
      mapOidcProfileToUser({
        sub: "abc",
        email: "student@example.com",
        emailVerified: true,
      }).emailVerified,
    ).toBe(true);
  });

  it("uses the first non-empty profile display name", () => {
    expect(
      mapOidcProfileToUser({
        sub: "abc",
        name: " ",
        preferred_username: " student ",
        nickname: "ignored",
      }).name,
    ).toBe("student");
  });

  it("maps GitHub profiles without trusting the email verification state", () => {
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

  it("uses a local fallback email for hidden GitHub emails", () => {
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

  it("maps Google email verification only when an email is present", () => {
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
