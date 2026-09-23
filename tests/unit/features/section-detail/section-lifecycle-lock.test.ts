import { describe, expect, it, vi } from "vitest";
import { acquireSectionLifecycleAdvisoryLocks } from "@/lib/db/section-lifecycle-lock";

describe("Section lifecycle advisory locks", () => {
  it("deduplicates and sorts shared lock IDs in one materialized query", async () => {
    const queryRawUnsafe = vi.fn().mockResolvedValue([]);

    await acquireSectionLifecycleAdvisoryLocks(
      { $queryRawUnsafe: queryRawUnsafe },
      [12, 3, 12],
      "shared",
    );

    expect(queryRawUnsafe).toHaveBeenCalledOnce();
    const [sql, namespace, ...ids] = queryRawUnsafe.mock.calls[0];
    expect(sql).toContain("WITH lock_ids AS MATERIALIZED");
    expect(sql).toContain("pg_advisory_xact_lock_shared");
    expect(sql).toContain('::text AS "acquired"');
    expect(sql).toContain("ARRAY[$2,$3]::integer[]");
    expect(sql).toContain('ORDER BY "id"');
    expect(namespace).toBe("life-ustc-section-lifecycle");
    expect(ids).toEqual([3, 12]);
  });

  it("uses blocking exclusive locks for lifecycle state changes", async () => {
    const queryRawUnsafe = vi.fn().mockResolvedValue([]);

    await acquireSectionLifecycleAdvisoryLocks(
      { $queryRawUnsafe: queryRawUnsafe },
      [9],
      "exclusive",
    );

    expect(queryRawUnsafe.mock.calls[0][0]).toContain("pg_advisory_xact_lock(");
  });
});
