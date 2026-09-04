import { describe, expect, it } from "vitest";
import { getDeviceApprovalFailureReason } from "@/features/oauth/server/device-approval-validation.server";
import { DEVICE_CODE_STATUS } from "@/lib/oauth/device-code";

const now = new Date("2026-01-01T00:00:00.000Z");
const future = new Date("2026-01-01T00:10:00.000Z");
const past = new Date("2025-12-31T23:59:00.000Z");

function record(
  overrides: Partial<Parameters<typeof getDeviceApprovalFailureReason>[0]> = {},
): Parameters<typeof getDeviceApprovalFailureReason>[0] {
  return {
    client: { disabled: false },
    expiresAt: future,
    status: DEVICE_CODE_STATUS.PENDING,
    ...overrides,
  };
}

describe("设备授权验证", () => {
  it("允许已启用客户端在过期前使用待处理代码", () => {
    expect(getDeviceApprovalFailureReason(record(), now)).toBeNull();
  });

  it("在检查过期时间或状态前拒绝已禁用客户端", () => {
    expect(
      getDeviceApprovalFailureReason(
        record({
          client: { disabled: true },
          expiresAt: past,
          status: DEVICE_CODE_STATUS.APPROVED,
        }),
        now,
      ),
    ).toBe("disabled");
  });

  it("拒绝已过期的待处理代码", () => {
    expect(
      getDeviceApprovalFailureReason(record({ expiresAt: past }), now),
    ).toBe("expired");
  });

  it("拒绝已使用过的代码", () => {
    expect(
      getDeviceApprovalFailureReason(
        record({ status: DEVICE_CODE_STATUS.DENIED }),
        now,
      ),
    ).toBe("used");
  });
});
