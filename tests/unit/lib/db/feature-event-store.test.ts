import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createBasePrismaMock,
  disconnectMock,
  featureCreateManyMock,
  issueCreateManyMock,
  transactionMock,
} = vi.hoisted(() => {
  const disconnect = vi.fn().mockResolvedValue(undefined);
  const featureCreateMany = vi.fn().mockResolvedValue({ count: 1 });
  const issueCreateMany = vi.fn().mockResolvedValue({ count: 1 });
  const transaction = vi.fn().mockResolvedValue([]);
  const client = {
    $disconnect: disconnect,
    $transaction: transaction,
    featureOperationEvent: { createMany: featureCreateMany },
    runtimeIssueEvent: { createMany: issueCreateMany },
  };
  return {
    createBasePrismaMock: vi.fn(() => client),
    disconnectMock: disconnect,
    featureCreateManyMock: featureCreateMany,
    issueCreateManyMock: issueCreateMany,
    transactionMock: transaction,
  };
});

vi.mock("@/lib/db/prisma-query-events", () => ({
  createBasePrisma: createBasePrismaMock,
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
    featureCreateManyMock.mockResolvedValue({ count: 1 });
    issueCreateManyMock.mockResolvedValue({ count: 1 });
    transactionMock.mockResolvedValue([]);
    disconnectMock.mockResolvedValue(undefined);
  });

  it("writes feature and issue rows in one transaction with duplicate-safe inserts", async () => {
    await writeObservabilityBatch({ features: [feature], issues: [issue] });

    expect(createBasePrismaMock).toHaveBeenCalledTimes(1);
    expect(featureCreateManyMock).toHaveBeenCalledWith({
      data: [feature],
      skipDuplicates: true,
    });
    expect(issueCreateManyMock).toHaveBeenCalledWith({
      data: [issue],
      skipDuplicates: true,
    });
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(transactionMock.mock.calls[0]?.[0]).toHaveLength(2);
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });

  it("disconnects its isolated client when the transaction fails", async () => {
    const failure = new Error("database unavailable");
    transactionMock.mockRejectedValueOnce(failure);

    await expect(writeObservabilityBatch({ features: [feature] })).rejects.toBe(
      failure,
    );
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an oversized combined batch before opening a client", async () => {
    const events = Array.from(
      { length: FEATURE_EVENT_STORE_MAX_BATCH_SIZE + 1 },
      (_, index) => ({ ...feature, id: `${index}` }),
    );

    await expect(writeObservabilityBatch({ features: events })).rejects.toThrow(
      `observability batch exceeds ${FEATURE_EVENT_STORE_MAX_BATCH_SIZE} rows`,
    );
    expect(createBasePrismaMock).not.toHaveBeenCalled();
  });

  it("does not create a database client for an empty batch", async () => {
    await expect(writeObservabilityBatch({})).resolves.toBeUndefined();
    expect(createBasePrismaMock).not.toHaveBeenCalled();
  });
});
