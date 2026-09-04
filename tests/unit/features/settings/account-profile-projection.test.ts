import { describe, expect, it } from "vitest";
import { projectAuthenticatedUserProfile } from "@/features/profile/lib/account-profile-projection";

const profile = {
  id: "user-1",
  email: "private@example.test",
  username: "private-user",
  name: "Private User",
  image: null,
  isAdmin: true,
  createdAt: new Date("2026-08-15T00:00:00Z"),
  updatedAt: new Date("2026-08-15T00:00:00Z"),
};

describe("account profile OAuth projection", () => {
  it("cookie session 可读取邮箱与自身管理员状态", () => {
    expect(
      projectAuthenticatedUserProfile(profile, {
        email: true,
        adminStatus: true,
      }),
    ).toMatchObject({ email: profile.email, isAdmin: true });
  });

  it("OAuth 无 email scope 时不暴露邮箱且永不暴露管理员状态", () => {
    expect(
      projectAuthenticatedUserProfile(profile, {
        email: false,
        adminStatus: false,
      }),
    ).toMatchObject({ email: null, isAdmin: null });
  });

  it("OAuth email scope 只解锁邮箱", () => {
    expect(
      projectAuthenticatedUserProfile(profile, {
        email: true,
        adminStatus: false,
      }),
    ).toMatchObject({ email: profile.email, isAdmin: null });
  });
});
