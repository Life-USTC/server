import { describe, expect, it, vi } from "vitest";
import {
  AUDIT_RETENTION_BATCH_SIZE,
  maintainAuditLogRetention,
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
});
