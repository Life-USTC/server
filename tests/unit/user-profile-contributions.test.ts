import { describe, expect, it, vi } from "vitest";
import { buildUserProfileContributions } from "@/features/profile/server/user-profile-contributions";

describe("用户主页贡献", () => {
  it("以上海午夜为界按校区日期聚合公开上传统计", async () => {
    const commentFindMany = vi.fn(async (_input: unknown) => [
      { createdAt: new Date("2026-03-01T15:59:00.000Z") },
    ]);
    const queryRaw = vi.fn(
      async (query: { sql: string; values: unknown[] }) => {
        if (query.sql.includes("get_public_profile_upload_stats")) {
          return [
            {
              createdAt: new Date("2026-03-01T16:00:00.000Z"),
              totalUploads: 7n,
            },
          ];
        }
        if (query.sql.includes("get_public_profile_homework_completions")) {
          return [{ completedAt: new Date("2026-03-01T16:30:00.000Z") }];
        }
        throw new Error(`Unexpected raw query: ${query.sql}`);
      },
    );
    const homeworkFindMany = vi.fn(async (_input: unknown) => [
      { createdAt: new Date("2026-03-02T04:00:00.000Z") },
    ]);

    const result = await buildUserProfileContributions(
      {
        $queryRaw: queryRaw as unknown as <T>(query: unknown) => Promise<T>,
        comment: { findMany: commentFindMany },
        homework: { findMany: homeworkFindMany },
      },
      "user-1",
      new Date("2026-03-02T01:30:00+08:00"),
    );

    const cells = new Map(
      result.weeks.flat().map((cell) => [cell.date, cell.count]),
    );
    const commentQuery = commentFindMany.mock.calls[0]?.[0] as {
      where: { createdAt: { gte: Date } };
    };

    expect(commentQuery.where.createdAt.gte.toISOString()).toBe(
      "2025-03-02T16:00:00.000Z",
    );
    expect(result.totalContributions).toBe(4);
    expect(result.totalUploads).toBe(7);
    expect(result.weeks[0]?.[0]?.date).toBe("2025-03-02");
    expect(result.weeks.at(-1)?.at(-1)?.date).toBe("2026-03-07");
    expect(cells.get("2026-03-01")).toBe(1);
    expect(cells.get("2026-03-02")).toBe(3);

    expect(queryRaw).toHaveBeenCalledTimes(2);
    const queries = queryRaw.mock.calls.map(([query]) => query);
    const uploadQuery = queries.find((query) =>
      query.sql.includes("get_public_profile_upload_stats"),
    );
    const completionQuery = queries.find((query) =>
      query.sql.includes("get_public_profile_homework_completions"),
    );
    expect(uploadQuery?.values[0]).toBe("user-1");
    expect(completionQuery?.values[0]).toBe("user-1");
  });
});
