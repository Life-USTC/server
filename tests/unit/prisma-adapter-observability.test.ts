import { afterEach, describe, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

const adapterState = vi.hoisted(
  (): {
    options?: {
      onConnectionError(error: Error): void;
      onPoolError(error: Error): void;
    };
  } => ({}),
);

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class {
    constructor(
      _config: unknown,
      options: {
        onConnectionError(error: Error): void;
        onPoolError(error: Error): void;
      },
    ) {
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
    adapterState.options = undefined;
    vi.restoreAllMocks();
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
