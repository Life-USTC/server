import { afterEach, describe, expect, it, vi } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { withRuntimeDatabaseAdapter } from "@/lib/db/prisma-adapter";
import { createDeferred } from "../../../shared/deferred";

const { connect, configurations } = vi.hoisted(() => ({
  connect: vi.fn(),
  configurations: [] as Record<string, unknown>[],
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class {
    connect = connect;
    constructor(configuration: Record<string, unknown>) {
      configurations.push(configuration);
    }
  },
}));

afterEach(() => {
  connect.mockReset();
  configurations.length = 0;
});

describe("owned runtime database adapters", () => {
  it("uses the selected role and closes only after its work settles", async () => {
    const result = createDeferred<string>();
    const started = createDeferred();
    const dispose = vi.fn().mockResolvedValue(undefined);
    const adapter = { dispose };
    connect.mockResolvedValue(adapter);

    await runWithCloudflareRuntimeEnv(
      {
        HYPERDRIVE: { connectionString: "postgresql://app@db.test/app" },
        HYPERDRIVE_AUTH: { connectionString: "postgresql://auth@db.test/app" },
      },
      async () => {
        const work = withRuntimeDatabaseAdapter("auth", async (connection) => {
          expect(connection).toBe(adapter);
          started.resolve();
          return result.promise;
        });
        await started.promise;
        expect(dispose).not.toHaveBeenCalled();
        result.resolve("written");
        await expect(work).resolves.toBe("written");
        expect(dispose).toHaveBeenCalledOnce();
      },
    );
    expect(configurations).toEqual([
      expect.objectContaining({
        connectionString: "postgresql://auth@db.test/app",
        max: 3,
        connectionTimeoutMillis: 5_000,
        query_timeout: 15_000,
      }),
    ]);
  });

  it("closes a failed operation and gives the next operation a new adapter", async () => {
    const first = { dispose: vi.fn().mockResolvedValue(undefined) };
    const second = { dispose: vi.fn().mockResolvedValue(undefined) };
    connect.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const failure = new Error("query failed");
    await runWithCloudflareRuntimeEnv(
      { HYPERDRIVE: { connectionString: "postgresql://app@db.test/app" } },
      async () => {
        await expect(
          withRuntimeDatabaseAdapter("app", async () => {
            throw failure;
          }),
        ).rejects.toBe(failure);
        expect(first.dispose).toHaveBeenCalledOnce();
        await expect(
          withRuntimeDatabaseAdapter("app", async (connection) => {
            expect(connection).toBe(second);
            return [];
          }),
        ).resolves.toEqual([]);
        expect(second.dispose).toHaveBeenCalledOnce();
      },
    );
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it("propagates connection failures without invoking the operation", async () => {
    const failure = new Error("connection failed");
    connect.mockRejectedValue(failure);
    const action = vi.fn();
    await runWithCloudflareRuntimeEnv(
      { HYPERDRIVE: { connectionString: "postgresql://app@db.test/app" } },
      async () => {
        await expect(withRuntimeDatabaseAdapter("app", action)).rejects.toBe(
          failure,
        );
      },
    );
    expect(action).not.toHaveBeenCalled();
  });
});
