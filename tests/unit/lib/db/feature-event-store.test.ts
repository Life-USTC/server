import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDeferred } from "../../../shared/deferred";

const { connectMock, executeRawMock, disposeMock, factoryMock } = vi.hoisted(
  () => ({
    connectMock: vi.fn(),
    executeRawMock: vi.fn(),
    disposeMock: vi.fn(),
    factoryMock: vi.fn(),
  }),
);
vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class {
    constructor(config: unknown) {
      factoryMock(config);
    }
    connect() {
      return connectMock();
    }
  },
}));
vi.mock("@/app-env", () => ({
  getOptionalTrimmedEnv: (name: string) =>
    name === "DATABASE_URL"
      ? "postgresql://app-role@localhost/test"
      : undefined,
}));
vi.mock("@/lib/log/app-logger", () => ({ logAppEvent: vi.fn() }));
vi.mock("@/lib/metrics/analytics-engine", () => ({
  writeDatabaseEventAnalytics: vi.fn(),
}));

import {
  FEATURE_EVENT_STORE_MAX_BATCH_SIZE,
  writeObservabilityBatch,
} from "@/lib/db/feature-event-store";

const feature = {
  id: "11111111-1111-4111-8111-111111111111",
  feature: "catalog.search",
  operation: "search",
  protocol: "web",
  surface: "web",
  authMode: "anonymous",
  outcome: "success",
  errorClass: "none",
  durationMs: 4.5,
} as const;
const issue = {
  id: "22222222-2222-4222-8222-222222222222",
  level: "error" as const,
  event: "api.request.error",
  route: "/api/search",
  status: 500,
};

describe("writeObservabilityBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeRawMock.mockReset().mockResolvedValue(1);
    disposeMock.mockReset().mockResolvedValue(undefined);
    connectMock
      .mockReset()
      .mockResolvedValue({ executeRaw: executeRawMock, dispose: disposeMock });
  });

  it("binds only allowed fields in one atomic duplicate-safe statement on its own app adapter", async () => {
    const privateInput = {
      ...feature,
      body: "private-body",
      token: "private-token",
    };
    await writeObservabilityBatch({
      features: [privateInput],
      issues: [issue],
    });
    expect(factoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: "postgresql://app-role@localhost/test",
      }),
    );
    expect(executeRawMock).toHaveBeenCalledTimes(1);
    const query = executeRawMock.mock.calls[0][0];
    expect(query.sql).toContain("WITH feature_insert AS");
    expect(query.sql.match(/ON CONFLICT DO NOTHING/g)).toHaveLength(2);
    expect(query.sql).not.toContain("RETURNING");
    expect(JSON.parse(query.args[0])).toEqual([
      { ...feature, occurredAt: null, requestId: null, userId: null },
    ]);
    expect(JSON.parse(query.args[1])).toEqual([
      { ...issue, occurredAt: null, requestId: null },
    ]);
    expect(query.sql).not.toContain(feature.id);
    expect(JSON.stringify(query)).not.toContain("private-");
    expect(disposeMock).toHaveBeenCalledTimes(1);
  });

  it("preserves supplied UTC milliseconds, null optionals, and omitted dates", async () => {
    const date = new Date("2026-10-11T12:13:14.567+08:00");
    await writeObservabilityBatch({
      features: [
        { ...feature, occurredAt: date, requestId: null, userId: null },
      ],
      issues: [
        {
          ...issue,
          occurredAt: null as unknown as Date,
          requestId: null,
          route: null,
          status: null,
        },
      ],
    });
    const query = executeRawMock.mock.calls[0][0];
    expect(JSON.parse(query.args[0])[0]).toMatchObject({
      occurredAt: "2026-10-11T04:13:14.567Z",
      requestId: null,
      userId: null,
    });
    expect(JSON.parse(query.args[1])[0]).toMatchObject({
      occurredAt: null,
      requestId: null,
      route: null,
      status: null,
    });
  });

  it("disposes only after the complete write settles, including a rejection", async () => {
    const pending = createDeferred<number>();
    const failure = new Error("database unavailable");
    executeRawMock.mockReturnValueOnce(pending.promise);
    const write = writeObservabilityBatch({ features: [feature] });
    const rejected = expect(write).rejects.toBe(failure);
    await Promise.resolve();
    expect(executeRawMock).toHaveBeenCalledTimes(1);
    expect(disposeMock).not.toHaveBeenCalled();
    pending.reject(failure);
    await rejected;
    expect(disposeMock).toHaveBeenCalledTimes(1);
  });

  it("accepts the combined 256-row boundary and rejects overflow before connecting", async () => {
    const events = Array.from(
      { length: FEATURE_EVENT_STORE_MAX_BATCH_SIZE - 1 },
      (_, i) => ({ ...feature, id: `event-${i}` }),
    );
    await writeObservabilityBatch({ features: events, issues: [issue] });
    expect(connectMock).toHaveBeenCalledTimes(1);
    await expect(
      writeObservabilityBatch({
        features: [...events, feature],
        issues: [issue],
      }),
    ).rejects.toThrow("observability batch exceeds 256 rows");
    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it("does not connect for an empty batch", async () => {
    await expect(writeObservabilityBatch({})).resolves.toBeUndefined();
    expect(connectMock).not.toHaveBeenCalled();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects duration %s before JSON can turn it into null",
    async (durationMs) => {
      await expect(
        writeObservabilityBatch({ features: [{ ...feature, durationMs }] }),
      ).rejects.toThrow("durationMs must be finite");
      expect(connectMock).not.toHaveBeenCalled();
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 500.5])(
    "rejects status %s before JSON can null or coerce it",
    async (status) => {
      await expect(
        writeObservabilityBatch({ issues: [{ ...issue, status }] }),
      ).rejects.toThrow("status must be an integer");
      expect(connectMock).not.toHaveBeenCalled();
    },
  );

  it("rejects invalid Date values in either table before default substitution", async () => {
    const occurredAt = new Date(Number.NaN);
    await expect(
      writeObservabilityBatch({ features: [{ ...feature, occurredAt }] }),
    ).rejects.toThrow("occurredAt must be a valid Date");
    await expect(
      writeObservabilityBatch({ issues: [{ ...issue, occurredAt }] }),
    ).rejects.toThrow("occurredAt must be a valid Date");
    expect(connectMock).not.toHaveBeenCalled();
  });

  it("does not let JSON record conversion coerce non-string text fields", async () => {
    await expect(
      writeObservabilityBatch({
        features: [{ ...feature, operation: 123 as unknown as string }],
      }),
    ).rejects.toThrow("text fields must be strings");
    await expect(
      writeObservabilityBatch({
        issues: [{ ...issue, requestId: [] as unknown as string }],
      }),
    ).rejects.toThrow("text fields must be strings");
    expect(connectMock).not.toHaveBeenCalled();
  });
});
