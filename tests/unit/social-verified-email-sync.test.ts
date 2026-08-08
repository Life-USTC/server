import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearStagedSocialVerifiedEmails,
  stageSocialVerifiedEmail,
} from "@/lib/auth/social-verified-email-staging";

const verifiedEmailUpsertMock = vi.fn();
const userFindUniqueMock = vi.fn();
const userUpdateMock = vi.fn();

vi.mock("@/lib/db/auth-prisma", () => ({
  authPrisma: {
    verifiedEmail: {
      upsert: (...args: unknown[]) => verifiedEmailUpsertMock(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => userFindUniqueMock(...args),
      update: (...args: unknown[]) => userUpdateMock(...args),
    },
  },
}));

import { syncSocialVerifiedEmailFromAccountHook } from "@/lib/auth/social-verified-email-plugin";

describe("social verified email sync", () => {
  afterEach(() => {
    clearStagedSocialVerifiedEmails();
    verifiedEmailUpsertMock.mockReset();
    userFindUniqueMock.mockReset();
    userUpdateMock.mockReset();
  });

  it("persists GitHub email into VerifiedEmail and upgrades placeholder User.email", async () => {
    stageSocialVerifiedEmail({
      provider: "github",
      accountId: "octocat",
      email: "octocat@example.com",
      emailVerified: true,
      name: "Octo Cat",
      image: "https://example.com/octocat.png",
    });
    verifiedEmailUpsertMock.mockResolvedValue(undefined);
    userFindUniqueMock.mockResolvedValue({
      email: "oidc-1@users.local",
      name: "USTC User 1",
      image: null,
      profilePictures: [],
    });
    userUpdateMock.mockResolvedValue(undefined);

    await syncSocialVerifiedEmailFromAccountHook({
      providerId: "github",
      providerAccountId: "octocat",
      userId: "user-1",
    });

    expect(verifiedEmailUpsertMock).toHaveBeenCalledWith({
      where: {
        provider_email: {
          provider: "github",
          email: "octocat@example.com",
        },
      },
      create: {
        userId: "user-1",
        provider: "github",
        email: "octocat@example.com",
      },
      update: {
        userId: "user-1",
      },
    });
    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        email: "octocat@example.com",
        emailVerified: true,
        image: "https://example.com/octocat.png",
        profilePictures: { push: "https://example.com/octocat.png" },
      },
    });
  });

  it("syncs OIDC profile images without publishing a provider email", async () => {
    stageSocialVerifiedEmail({
      provider: "oidc",
      accountId: "435",
      email: null,
      emailVerified: false,
      name: "Student",
      image: "https://example.com/ustc.png",
    });
    userFindUniqueMock.mockResolvedValue({
      email: "oidc-435@users.local",
      name: "",
      image: null,
      profilePictures: [],
    });
    userUpdateMock.mockResolvedValue(undefined);

    await syncSocialVerifiedEmailFromAccountHook({
      providerId: "oidc",
      providerAccountId: "435",
      userId: "user-1",
    });
    expect(verifiedEmailUpsertMock).not.toHaveBeenCalled();
    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        name: "Student",
        image: "https://example.com/ustc.png",
        profilePictures: { push: "https://example.com/ustc.png" },
      },
    });
  });

  it("skips providers without staged profile data", async () => {
    await syncSocialVerifiedEmailFromAccountHook({
      providerId: "google",
      providerAccountId: "google-user",
      userId: "user-1",
    });
    expect(verifiedEmailUpsertMock).not.toHaveBeenCalled();
  });
});
