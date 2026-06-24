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

describe("device approval validation", () => {
  it("allows pending codes for enabled clients before expiry", () => {
    expect(getDeviceApprovalFailureReason(record(), now)).toBeNull();
  });

  it("rejects disabled clients before checking expiry or status", () => {
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

  it("rejects expired pending codes", () => {
    expect(
      getDeviceApprovalFailureReason(record({ expiresAt: past }), now),
    ).toBe("expired");
  });

  it("rejects already-used codes", () => {
    expect(
      getDeviceApprovalFailureReason(
        record({ status: DEVICE_CODE_STATUS.DENIED }),
        now,
      ),
    ).toBe("used");
  });
});
