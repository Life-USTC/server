import { describe, expect, it, vi } from "vitest";
import { buildUserProfileContributions } from "@/features/profile/server/user-profile-contributions";

describe("用户主页贡献", () => {
  it("以上海午夜为界按校区日期聚合贡献事件", async () => {
    const commentFindMany = vi.fn(async (_input: unknown) => [
      { createdAt: new Date("2026-03-01T15:59:00.000Z") },
    ]);
    const uploadFindMany = vi.fn(async (_input: unknown) => [
      { createdAt: new Date("2026-03-01T16:00:00.000Z") },
    ]);
    const completionFindMany = vi.fn(async (_input: unknown) => [
      { completedAt: new Date("2026-03-01T16:30:00.000Z") },
    ]);
    const homeworkFindMany = vi.fn(async (_input: unknown) => [
      { createdAt: new Date("2026-03-02T04:00:00.000Z") },
    ]);

    const result = await buildUserProfileContributions(
      {
        comment: { findMany: commentFindMany },
        homework: { findMany: homeworkFindMany },
        homeworkCompletion: { findMany: completionFindMany },
        upload: { findMany: uploadFindMany },
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
    expect(result.weeks[0]?.[0]?.date).toBe("2025-03-02");
    expect(result.weeks.at(-1)?.at(-1)?.date).toBe("2026-03-07");
    expect(cells.get("2026-03-01")).toBe(1);
    expect(cells.get("2026-03-02")).toBe(3);
  });
});
