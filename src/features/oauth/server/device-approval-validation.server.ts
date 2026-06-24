import { DEVICE_CODE_STATUS } from "@/lib/oauth/device-code";

export type DeviceApprovalValidationRecord = {
  client: { disabled: boolean };
  expiresAt: Date;
  status: string;
};

export type DeviceApprovalFailureReason = "disabled" | "expired" | "used";

export function getDeviceApprovalFailureReason(
  record: DeviceApprovalValidationRecord,
  now = new Date(),
): DeviceApprovalFailureReason | null {
  if (record.client.disabled) return "disabled";
  if (record.expiresAt < now) return "expired";
  if (record.status !== DEVICE_CODE_STATUS.PENDING) return "used";
  return null;
}
