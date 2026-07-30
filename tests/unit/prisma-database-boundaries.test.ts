import { afterEach, describe, expect, it, vi } from "vitest";
import {
  runWithCloudflareRuntimeEnv,
  setCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";

const { adapterConfigs, prismaClientOptions } = vi.hoisted(() => ({
  adapterConfigs: [] as Array<{ connectionString: string }>,
  prismaClientOptions: [] as Array<Record<string, unknown>>,
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class {
    constructor(config: { connectionString: string }) {
      adapterConfigs.push(config);
    }
  },
}));

vi.mock("@/generated/prisma/client", () => ({
  PrismaClient: class {
    constructor(options: Record<string, unknown>) {
      prismaClientOptions.push(options);
    }
  },
}));

vi.mock("@/lib/log/app-logger", () => ({ logAppEvent: vi.fn() }));

const poolConfig = {
  max: 3,
  idleTimeoutMillis: 5_000,
};

describe("Prisma database boundaries", () => {
  afterEach(() => {
    adapterConfigs.length = 0;
    prismaClientOptions.length = 0;
    setCloudflareRuntimeEnv(undefined);
    vi.unstubAllEnvs();
  });

  it("omits calendar feed tokens only from the auth client", async () => {
    const { createBasePrisma } = await import("@/lib/db/prisma-query-events");

    createBasePrisma("postgresql://app.example/database");
    createBasePrisma("postgresql://auth.example/database", "auth");

    expect(prismaClientOptions).toHaveLength(2);
    expect(prismaClientOptions[0]).not.toHaveProperty("omit");
    expect(prismaClientOptions[1]).toMatchObject({
      omit: { user: { calendarFeedToken: true } },
    });
  });

  it("uses independent app and auth Hyperdrive bindings", async () => {
    const { createPrismaAdapter } = await import("@/lib/db/prisma-adapter");

    await runWithCloudflareRuntimeEnv(
      {
        HYPERDRIVE: { connectionString: "postgresql://app.example/database" },
        HYPERDRIVE_AUTH: {
          connectionString: "postgresql://auth.example/database",
        },
      },
      () => {
        createPrismaAdapter();
        createPrismaAdapter(undefined, "auth");
      },
    );

    expect(adapterConfigs).toEqual([
      {
        connectionString: "postgresql://app.example/database",
        ...poolConfig,
      },
      {
        connectionString: "postgresql://auth.example/database",
        ...poolConfig,
      },
    ]);
  });

  it("fails closed when the auth binding is missing in Cloudflare", async () => {
    const { createPrismaAdapter } = await import("@/lib/db/prisma-adapter");

    await expect(
      runWithCloudflareRuntimeEnv(
        {
          HYPERDRIVE: { connectionString: "postgresql://app.example/database" },
        },
        () => createPrismaAdapter(undefined, "auth"),
      ),
    ).rejects.toThrow(
      "HYPERDRIVE_AUTH is required to initialize auth Prisma in Cloudflare runtime",
    );
  });

  it("validates both Hyperdrive bindings before serving a Cloudflare request", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { loadEnv } = await import("@/lib/adapters/cloudflare-env");

    await expect(
      runWithCloudflareRuntimeEnv(
        {
          HYPERDRIVE: { connectionString: "postgresql://app.example/database" },
        },
        () =>
          loadEnv({
            input: { AUTH_SECRET: "secret", NODE_ENV: "production" },
          }),
      ),
    ).rejects.toThrow("Invalid environment variables");

    await expect(
      runWithCloudflareRuntimeEnv(
        {
          HYPERDRIVE: { connectionString: "postgresql://app.example/database" },
          HYPERDRIVE_AUTH: {
            connectionString: "postgresql://auth.example/database",
          },
        },
        () =>
          loadEnv({
            input: { AUTH_SECRET: "secret", NODE_ENV: "production" },
          }),
      ),
    ).resolves.toMatchObject({ NODE_ENV: "production" });
    consoleError.mockRestore();
  });

  it("allows DATABASE_URL fallback for auth only outside production", async () => {
    const { createPrismaAdapter } = await import("@/lib/db/prisma-adapter");
    vi.stubEnv("AUTH_DATABASE_URL", "");
    vi.stubEnv("DATABASE_URL", "postgresql://local.example/database");
    vi.stubEnv("NODE_ENV", "test");

    createPrismaAdapter(undefined, "auth");
    expect(adapterConfigs).toEqual([
      {
        connectionString: "postgresql://local.example/database",
        ...poolConfig,
      },
    ]);

    vi.stubEnv("NODE_ENV", "production");
    expect(() => createPrismaAdapter(undefined, "auth")).toThrow(
      "AUTH_DATABASE_URL is required to initialize auth Prisma in production",
    );
  });

  it("requires AUTH_DATABASE_URL before starting a Node production runtime", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { loadEnv } = await import("@/lib/adapters/cloudflare-env");

    expect(() =>
      loadEnv({
        input: {
          AUTH_SECRET: "secret",
          DATABASE_URL: "postgresql://app.example/database",
          NODE_ENV: "production",
        },
      }),
    ).toThrow("Invalid environment variables");
    expect(
      loadEnv({
        input: {
          AUTH_DATABASE_URL: "postgresql://auth.example/database",
          AUTH_SECRET: "secret",
          DATABASE_URL: "postgresql://app.example/database",
          NODE_ENV: "production",
        },
      }),
    ).toMatchObject({ NODE_ENV: "production" });
    consoleError.mockRestore();
  });
});
