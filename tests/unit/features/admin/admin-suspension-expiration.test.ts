import { describe, expect, it } from "vitest";
import { adminUserSuspensionExpiresAt } from "@/features/admin/lib/admin-users-display";
import { expiresAtFromModerationDuration } from "@/features/admin/lib/moderation-action-display";
import { adminCreateSuspensionRequestSchema } from "@/lib/api/schemas/request-schemas";

describe("admin 封禁过期时间输入", () => {
  it("将省略、null 和空过期值视为永久", () => {
    const base = { userId: "user-1" };

    expect(adminCreateSuspensionRequestSchema.safeParse(base).success).toBe(
      true,
    );
    expect(
      adminCreateSuspensionRequestSchema.safeParse({
        ...base,
        expiresAt: null,
      }).success,
    ).toBe(true);
    expect(
      adminCreateSuspensionRequestSchema.safeParse({
        ...base,
        expiresAt: "   ",
      }).success,
    ).toBe(true);
  });

  it("拒绝无效的非空过期值", () => {
    const result = adminCreateSuspensionRequestSchema.safeParse({
      userId: "user-1",
      expiresAt: "not-a-date",
    });

    expect(result.success).toBe(false);
  });

  it("拒绝溢出的日历日期", () => {
    for (const expiresAt of [
      "2026-02-31",
      "2026-13-01",
      "2026-02-31T12:00",
      "2026-02-31T12:00:00Z",
      "2026-2-31",
      "2026/02/31",
      "2026.02.31",
      "02/31/2026",
      "February 31, 2026",
    ]) {
      expect(
        adminCreateSuspensionRequestSchema.safeParse({
          userId: "user-1",
          expiresAt,
        }).success,
      ).toBe(false);
    }
  });

  it("保留无效的自定义 UI 过期值以供 API 拒绝", () => {
    expect(adminUserSuspensionExpiresAt("custom", "not-a-date")).toBe(
      "not-a-date",
    );
    expect(expiresAtFromModerationDuration("custom", "not-a-date")).toBe(
      "not-a-date",
    );
    expect(adminUserSuspensionExpiresAt("custom", "   ")).toBeUndefined();
    expect(expiresAtFromModerationDuration("custom", "   ")).toBeUndefined();
  });
});
