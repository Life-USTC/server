import { afterEach, describe, expect, it, vi } from "vitest";

describe("Prisma adapter runtime database env", () => {
  afterEach(async () => {
    const { setCloudflareRuntimeEnv } = await import(
      "@/lib/cloudflare/runtime-env"
    );
    setCloudflareRuntimeEnv(null);
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("keeps DATABASE_URL for non-Worker runtimes", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://postgres:postgres@localhost:5432/app",
    );

    const { createPrismaAdapter } = await import("@/lib/db/prisma-adapter");

    expect(() => createPrismaAdapter()).not.toThrow();
  });

  it("requires Hyperdrive in Cloudflare runtime even when DATABASE_URL exists", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://postgres:postgres@localhost:5432/app",
    );

    const { setCloudflareRuntimeEnv } = await import(
      "@/lib/cloudflare/runtime-env"
    );
    setCloudflareRuntimeEnv({});

    const { createPrismaAdapter } = await import("@/lib/db/prisma-adapter");

    expect(() => createPrismaAdapter()).toThrow(
      "HYPERDRIVE is required to initialize Prisma in Cloudflare runtime",
    );
  });
});
