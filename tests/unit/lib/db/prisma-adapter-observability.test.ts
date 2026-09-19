import { afterEach, describe, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

const adapterState = vi.hoisted(
  (): {
    config?: Record<string, unknown>;
    options?: {
      onConnectionError(error: Error): void;
      onPoolError(error: Error): void;
    };
  } => ({}),
);

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class {
    constructor(
      config: Record<string, unknown>,
      options: {
        onConnectionError(error: Error): void;
        onPoolError(error: Error): void;
      },
    ) {
      adapterState.config = config;
      adapterState.options = options;
    }
  },
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: vi.fn(),
}));

describe("Prisma adapter observability", () => {
  afterEach(() => {
    setCloudflareRuntimeEnv(undefined);
    adapterState.config = undefined;
    adapterState.options = undefined;
    vi.restoreAllMocks();
  });

  it("caps the per-request pool and expires idle connections quickly", async () => {
    const { createPrismaAdapter } = await import("@/lib/db/prisma-adapter");

    createPrismaAdapter("postgresql://example.test/database");

    expect(adapterState.config).toMatchObject({
      connectionString: "postgresql://example.test/database",
      max: 3,
      idleTimeoutMillis: 5_000,
    });
  });

  it("bounds connect and query waits so a wedged database cannot hang the Worker", async () => {
    const {
      createPrismaAdapter,
      RUNTIME_DATABASE_CONNECTION_TIMEOUT_MS,
      RUNTIME_DATABASE_QUERY_TIMEOUT_MS,
    } = await import("@/lib/db/prisma-adapter");

    for (const database of ["app", "auth"] as const) {
      createPrismaAdapter("postgresql://example.test/database", database);
      const config = adapterState.config;

      expect(config).toMatchObject({
        connectionTimeoutMillis: RUNTIME_DATABASE_CONNECTION_TIMEOUT_MS,
        query_timeout: RUNTIME_DATABASE_QUERY_TIMEOUT_MS,
      });
      // pg treats 0/undefined as "wait forever", which is what parked requests
      // until the runtime's hang detector cancelled them.
      expect(config?.connectionTimeoutMillis).toBeGreaterThan(0);
      expect(config?.query_timeout).toBeGreaterThan(0);
    }
  });

  it("gives maintenance crons a longer but still finite query budget", async () => {
    const {
      createPrismaAdapter,
      MAINTENANCE_DATABASE_CONNECTION_TIMEOUT_MS,
      MAINTENANCE_DATABASE_QUERY_TIMEOUT_MS,
      RUNTIME_DATABASE_QUERY_TIMEOUT_MS,
    } = await import("@/lib/db/prisma-adapter");

    createPrismaAdapter("postgresql://example.test/database", "maintenance");

    expect(adapterState.config).toMatchObject({
      connectionTimeoutMillis: MAINTENANCE_DATABASE_CONNECTION_TIMEOUT_MS,
      query_timeout: MAINTENANCE_DATABASE_QUERY_TIMEOUT_MS,
    });
    expect(MAINTENANCE_DATABASE_QUERY_TIMEOUT_MS).toBeGreaterThan(
      RUNTIME_DATABASE_QUERY_TIMEOUT_MS,
    );
    expect(Number.isFinite(MAINTENANCE_DATABASE_QUERY_TIMEOUT_MS)).toBe(true);
  });

  it("writes unsampled connection and pool failure counters without messages", async () => {
    const writeDataPoint = vi.fn();
    setCloudflareRuntimeEnv({ ANALYTICS: { writeDataPoint } });
    const { createPrismaAdapter } = await import("@/lib/db/prisma-adapter");

    createPrismaAdapter("postgresql://example.test/database");
    adapterState.options?.onConnectionError(
      new TypeError("private connection detail"),
    );
    adapterState.options?.onPoolError(new Error("private pool detail"));

    expect(writeDataPoint).toHaveBeenNthCalledWith(1, {
      indexes: ["database:connection_error"],
      blobs: ["database_event", "connection_error", "TypeError"],
      doubles: [1],
    });
    expect(writeDataPoint).toHaveBeenNthCalledWith(2, {
      indexes: ["database:pool_error"],
      blobs: ["database_event", "pool_error", "Error"],
      doubles: [1],
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain("private");
  });
});
