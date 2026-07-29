import { describe, expect, it, vi } from "vitest";
import {
  buildUserProfileContributions,
  loadUserProfileContributionDays,
} from "@/features/profile/server/user-profile-contributions";

function buildPrismaMock(
  queryRaw: (
    query: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>,
) {
  return {
    async $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]) {
      return (await queryRaw(query, ...values)) as T;
    },
  };
}

describe("用户主页贡献", () => {
  it("以上海午夜为界按校区日期聚合贡献事件", async () => {
    const queryRaw = vi.fn(
      async (_query: TemplateStringsArray, ..._values: unknown[]) => [
        { count: 1n, date: "2026-03-01" },
        { count: 3n, date: "2026-03-02" },
      ],
    );

    const result = await buildUserProfileContributions(
      buildPrismaMock(queryRaw),
      "user-1",
      new Date("2026-03-02T01:30:00+08:00"),
    );

    const cells = new Map(
      result.weeks.flat().map((cell) => [cell.date, cell.count]),
    );
    const queryValues = queryRaw.mock.calls[0]?.slice(1) ?? [];

    expect(queryRaw).toHaveBeenCalledOnce();
    expect(queryValues.filter((value) => value === "user-1")).toHaveLength(4);
    expect(
      queryValues
        .filter((value): value is Date => value instanceof Date)
        .map((value) => value.toISOString()),
    ).toEqual(Array.from({ length: 4 }, () => "2025-03-02T16:00:00.000Z"));
    expect(result.totalContributions).toBe(4);
    expect(result.weeks[0]?.[0]?.date).toBe("2025-03-02");
    expect(result.weeks.at(-1)?.at(-1)?.date).toBe("2026-03-07");
    expect(cells.get("2026-03-01")).toBe(1);
    expect(cells.get("2026-03-02")).toBe(3);
  });

  it("在单条参数化 SQL 中聚合四类贡献并保留原过滤条件", async () => {
    const queryRaw = vi.fn(
      async (_query: TemplateStringsArray, ..._values: unknown[]) => [],
    );

    await loadUserProfileContributionDays(
      buildPrismaMock(queryRaw),
      "user-2",
      new Date("2025-03-02T16:00:00.000Z"),
    );

    const queryParts = queryRaw.mock.calls[0]?.[0] as
      | TemplateStringsArray
      | undefined;
    const sql = queryParts ? Array.from(queryParts).join("?") : "";

    expect(queryRaw).toHaveBeenCalledOnce();
    expect(sql).toContain('FROM "Comment"');
    expect(sql).toContain('FROM "Upload"');
    expect(sql).toContain('FROM "HomeworkCompletion"');
    expect(sql).toContain('FROM "Homework"');
    expect(sql).toContain("AT TIME ZONE 'UTC'");
    expect(sql).toContain("AT TIME ZONE 'Asia/Shanghai'");
    expect(sql).toContain("\"status\" IN ('active', 'softbanned')");
    expect(sql).toContain('"deletedAt" IS NULL');
    expect(sql).not.toContain('"createdAt" <=');
    expect(sql).not.toContain('"completedAt" <=');
  });
});
