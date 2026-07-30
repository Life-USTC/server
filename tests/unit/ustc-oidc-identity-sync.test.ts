import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearStagedUstcOidcIdentityClaims,
  consumeStagedUstcOidcIdentityClaims,
  stageUstcOidcIdentityClaims,
} from "@/lib/auth/ustc-oidc-identity-staging";

const withUserDbContextMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: (...args: unknown[]) => withUserDbContextMock(...args),
}));

import { syncUstcOidcIdentity } from "@/lib/auth/ustc-oidc-identity-sync";

describe("USTC OIDC identity sync", () => {
  afterEach(() => {
    clearStagedUstcOidcIdentityClaims();
    withUserDbContextMock.mockReset();
  });

  it("stages and consumes claims by upstream uid", () => {
    stageUstcOidcIdentityClaims({
      upstreamUid: "435",
      gid: "gid-435",
      sno: "BA435",
    });

    expect(consumeStagedUstcOidcIdentityClaims("435")).toEqual({
      upstreamUid: "435",
      gid: "gid-435",
      sno: "BA435",
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

    await syncUstcOidcIdentity({
      userId: "user-1",
      upstreamUid: "435",
      gid: "gid-435",
      sno: null,
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
  });
});
