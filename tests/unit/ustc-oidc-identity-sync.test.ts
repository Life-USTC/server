import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearStagedUstcOidcIdentityClaims,
  consumeStagedUstcOidcIdentityClaims,
  stageUstcOidcIdentityClaims,
} from "@/lib/auth/ustc-oidc-identity-staging";

const withUserDbContextMock = vi.fn();
const verifiedEmailUpsertMock = vi.fn();
const userUpdateMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: (...args: unknown[]) => withUserDbContextMock(...args),
}));

vi.mock("@/lib/db/auth-prisma", () => ({
  authPrisma: {
    verifiedEmail: {
      upsert: (...args: unknown[]) => verifiedEmailUpsertMock(...args),
    },
    user: {
      update: (...args: unknown[]) => userUpdateMock(...args),
    },
  },
}));

import { syncUstcOidcIdentity } from "@/lib/auth/ustc-oidc-identity-sync";

describe("USTC OIDC identity sync", () => {
  afterEach(() => {
    clearStagedUstcOidcIdentityClaims();
    withUserDbContextMock.mockReset();
    verifiedEmailUpsertMock.mockReset();
    userUpdateMock.mockReset();
  });

  it("stages and consumes claims by upstream uid", () => {
    stageUstcOidcIdentityClaims({
      upstreamUid: "435",
      gid: "gid-435",
      sno: "BA435",
      email: "student@mail.ustc.edu.cn",
      emailVerified: true,
      name: "Student",
      picture: null,
    });

    expect(consumeStagedUstcOidcIdentityClaims("435")).toEqual({
      upstreamUid: "435",
      gid: "gid-435",
      sno: "BA435",
      email: "student@mail.ustc.edu.cn",
      emailVerified: true,
      name: "Student",
      picture: null,
    });
    expect(consumeStagedUstcOidcIdentityClaims("435")).toBeNull();
  });

  it("upserts identity records without overwriting missing gid/sno", async () => {
    const upsertMock = vi.fn().mockResolvedValue(undefined);
    withUserDbContextMock.mockImplementation(
      async (_userId: string, action: (tx: unknown) => Promise<unknown>) =>
        action({
          userUstcIdentity: { upsert: upsertMock },
        }),
    );
    verifiedEmailUpsertMock.mockResolvedValue(undefined);
    userUpdateMock.mockResolvedValue(undefined);

    await syncUstcOidcIdentity({
      userId: "user-1",
      upstreamUid: "435",
      gid: "gid-435",
      sno: null,
      email: "student@mail.ustc.edu.cn",
      emailVerified: true,
      name: "Student",
      picture: "https://example.com/a.png",
    });

    expect(upsertMock).toHaveBeenCalledWith({
      where: {
        userId_upstreamUid: {
          userId: "user-1",
          upstreamUid: "435",
        },
      },
      create: {
        userId: "user-1",
        upstreamUid: "435",
        gid: "gid-435",
        sno: null,
      },
      update: {
        gid: "gid-435",
      },
    });
    expect(verifiedEmailUpsertMock).toHaveBeenCalledWith({
      where: {
        provider_email: {
          provider: "oidc",
          email: "student@mail.ustc.edu.cn",
        },
      },
      create: {
        userId: "user-1",
        provider: "oidc",
        email: "student@mail.ustc.edu.cn",
      },
      update: {
        userId: "user-1",
      },
    });
    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        email: "student@mail.ustc.edu.cn",
        emailVerified: true,
        name: "Student",
        image: "https://example.com/a.png",
      },
    });
  });

  it("skips VerifiedEmail writes for placeholder emails", async () => {
    const upsertMock = vi.fn().mockResolvedValue(undefined);
    withUserDbContextMock.mockImplementation(
      async (_userId: string, action: (tx: unknown) => Promise<unknown>) =>
        action({
          userUstcIdentity: { upsert: upsertMock },
        }),
    );

    await syncUstcOidcIdentity({
      userId: "user-1",
      upstreamUid: "435",
      gid: null,
      sno: null,
      email: null,
      emailVerified: false,
      name: null,
      picture: null,
    });

    expect(verifiedEmailUpsertMock).not.toHaveBeenCalled();
    expect(userUpdateMock).not.toHaveBeenCalled();
  });
});
