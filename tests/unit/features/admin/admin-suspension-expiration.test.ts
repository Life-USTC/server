import { afterEach, describe, expect, it, vi } from "vitest";
import { suspensionExpiresAt } from "@/features/admin/lib/suspension-expiration";
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
    expect(suspensionExpiresAt("custom", " not-a-date ")).toBe("not-a-date");
    expect(suspensionExpiresAt("custom", "   ")).toBeUndefined();
    expect(suspensionExpiresAt("custom", "")).toBeUndefined();
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    ["1d", "2026-09-26T12:00:00+08:00"],
    ["3d", "2026-09-28T12:00:00+08:00"],
    ["7d", "2026-10-02T12:00:00+08:00"],
    ["30d", "2026-10-25T12:00:00+08:00"],
  ])("将 %s 转换为上海时区的到期时间", (duration, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T04:00:00Z"));
    expect(suspensionExpiresAt(duration, "ignored")).toBe(expected);
  });

  it("保留永久和自定义时间选项的含义", () => {
    expect(suspensionExpiresAt("permanent", "not-a-date")).toBeUndefined();
    expect(suspensionExpiresAt("custom", "2026-10-01T15:30")).toBe(
      "2026-10-01T15:30:00+08:00",
    );
  });

  it.each(["14d", "0d", "-1d", "1.5d", "", "invalid", "2026-10-01"])(
    "拒绝未提供的时长 %s，不能回退为三天或永久",
    (duration) => {
      expect(() => suspensionExpiresAt(duration, "")).toThrow(RangeError);
    },
  );
});
