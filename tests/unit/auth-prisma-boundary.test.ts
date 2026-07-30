import { describe, expect, it, vi } from "vitest";
import {
  getCloudflareAuthHyperdriveConnectionString,
  runWithCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";

const { appClient, createBasePrismaMock, firstClient, secondClient } =
  vi.hoisted(() => ({
    appClient: { user: { boundary: "app" } },
    createBasePrismaMock: vi.fn(),
    firstClient: { user: { boundary: "first-auth" } },
    secondClient: { user: { boundary: "second-auth" } },
  }));

vi.mock("@/lib/db/prisma-query-events", () => ({
  createBasePrisma: createBasePrismaMock,
  logPrismaQuery: vi.fn(),
}));

vi.mock("@/lib/db/prisma-query-logging", () => ({
  shouldEnablePrismaQueryLogging: () => false,
}));

describe("auth Prisma boundary", () => {
  it("keeps overlapping Cloudflare requests on their own auth clients", async () => {
    createBasePrismaMock.mockReset().mockImplementation((_url, database) => {
      if (database !== "auth") return appClient;
      return getCloudflareAuthHyperdriveConnectionString()?.includes("one")
        ? firstClient
        : secondClient;
    });
    const { authPrisma } = await import("@/lib/db/auth-prisma");
    let releaseBarrier: () => void = () => undefined;
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = () => resolve();
    });
    let waiting = 0;

    const readAcrossBarrier = (
      suffix: "one" | "two",
      expected: typeof firstClient.user,
    ) =>
      runWithCloudflareRuntimeEnv(
        {
          HYPERDRIVE: {
            connectionString: `postgresql://app-${suffix}/database`,
          },
          HYPERDRIVE_AUTH: {
            connectionString: `postgresql://auth-${suffix}/database`,
          },
        },
        async () => {
          expect(authPrisma.user).toBe(expected);
          waiting += 1;
          if (waiting === 2) releaseBarrier();
          await barrier;
          expect(authPrisma.user).toBe(expected);
        },
      );

    await Promise.all([
      readAcrossBarrier("one", firstClient.user),
      readAcrossBarrier("two", secondClient.user),
    ]);

    expect(createBasePrismaMock).toHaveBeenCalledTimes(2);
    expect(createBasePrismaMock).toHaveBeenCalledWith(undefined, "auth");
  });

  it("keeps app and auth clients distinct inside one request", async () => {
    createBasePrismaMock
      .mockReset()
      .mockImplementation((_url, database) =>
        database === "auth" ? firstClient : appClient,
      );
    const [{ authPrisma }, { prisma }] = await Promise.all([
      import("@/lib/db/auth-prisma"),
      import("@/lib/db/prisma"),
    ]);

    await runWithCloudflareRuntimeEnv(
      {
        HYPERDRIVE: { connectionString: "postgresql://app/database" },
        HYPERDRIVE_AUTH: { connectionString: "postgresql://auth/database" },
      },
      () => {
        expect(prisma.user).toBe(appClient.user);
        expect(authPrisma.user).toBe(firstClient.user);
        expect(prisma.user).toBe(appClient.user);
        expect(authPrisma.user).toBe(firstClient.user);
      },
    );

    expect(createBasePrismaMock).toHaveBeenCalledTimes(2);
    expect(createBasePrismaMock).toHaveBeenCalledWith();
    expect(createBasePrismaMock).toHaveBeenCalledWith(undefined, "auth");
  });
});
