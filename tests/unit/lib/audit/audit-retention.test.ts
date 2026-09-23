import { describe, expect, it, vi } from "vitest";
import {
  AUDIT_RETENTION_BATCH_SIZE,
  maintainAuditLogRetention,
  maintainOAuthGrantUsageRetention,
} from "@/features/admin/server/audit-retention";

describe("audit retention maintenance", () => {
  it("calls only the bounded security-definer function", async () => {
    const now = new Date("2026-08-15T00:00:00.000Z");
    const queryRaw = vi.fn().mockResolvedValue([
      {
        attribution_anonymized: 3n,
        network_anonymized: 5n,
        rows_deleted: 2n,
      },
    ]);

    await expect(
      maintainAuditLogRetention({ $queryRaw: queryRaw } as never, now),
    ).resolves.toEqual({
      auditRetentionBatches: 1,
      auditRetentionComplete: true,
      attributionAnonymized: 3,
      networkAnonymized: 5,
      rowsDeleted: 2,
    });
    const query = queryRaw.mock.calls[0]?.[0] as {
      sql: string;
      values: unknown[];
    };
    expect(query.sql).toContain("FROM public.maintain_audit_log_retention(");
    expect(query.values).toEqual([now, AUDIT_RETENTION_BATCH_SIZE]);
  });

  it("continues across batches until more than 1000 eligible rows are drained", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([
        {
          attribution_anonymized: 1000n,
          network_anonymized: 1000n,
          rows_deleted: 1000n,
        },
      ])
      .mockResolvedValueOnce([
        {
          attribution_anonymized: 1n,
          network_anonymized: 1n,
          rows_deleted: 1n,
        },
      ]);

    await expect(
      maintainAuditLogRetention({ $queryRaw: queryRaw } as never),
    ).resolves.toEqual({
      auditRetentionBatches: 2,
      auditRetentionComplete: true,
      attributionAnonymized: 1001,
      networkAnonymized: 1001,
      rowsDeleted: 1001,
    });
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it("reports an incomplete drain when the explicit batch budget is exhausted", async () => {
    const queryRaw = vi.fn().mockResolvedValue([
      {
        attribution_anonymized: 1000n,
        network_anonymized: 1000n,
        rows_deleted: 1000n,
      },
    ]);

    await expect(
      maintainAuditLogRetention({ $queryRaw: queryRaw } as never, new Date(), {
        maxBatches: 2,
      }),
    ).resolves.toMatchObject({
      auditRetentionBatches: 2,
      auditRetentionComplete: false,
      rowsDeleted: 2000,
    });
  });

  it("drains OAuth usage across bounded batches", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ rows_deleted: 1000n }])
      .mockResolvedValueOnce([{ rows_deleted: 5n }]);

    await expect(
      maintainOAuthGrantUsageRetention({ $queryRaw: queryRaw } as never),
    ).resolves.toEqual({
      oauthRetentionBatches: 2,
      oauthRetentionComplete: true,
      oauthUsageRowsDeleted: 1005,
    });
  });
});
