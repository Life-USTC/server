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
    });
    userUpdateMock.mockResolvedValue(undefined);

    await syncSocialVerifiedEmailFromAccountHook({
      accountId: "octocat",
      providerId: "github",
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
      },
    });
  });

  it("skips non-social providers and missing staged emails", async () => {
    await syncSocialVerifiedEmailFromAccountHook({
      accountId: "435",
      providerId: "oidc",
      userId: "user-1",
    });
    expect(verifiedEmailUpsertMock).not.toHaveBeenCalled();

    await syncSocialVerifiedEmailFromAccountHook({
      accountId: "google-user",
      providerId: "google",
      userId: "user-1",
    });
    expect(verifiedEmailUpsertMock).not.toHaveBeenCalled();
  });
});
