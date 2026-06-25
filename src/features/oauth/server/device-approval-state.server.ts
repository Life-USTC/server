import { prisma } from "@/lib/db/prisma";
import { normalizeUserCode } from "@/lib/oauth/device-code";
import { getDeviceApprovalFailureReason } from "./device-approval-validation.server";
import { requireDeviceUserId } from "./device-auth.server";
import type { DeviceCopy } from "./device-copy.server";
import { callbackPath } from "./device-url.server";

export async function loadDeviceApprovalState({
  code,
  copy,
  request,
  url,
}: {
  code: string;
  copy: DeviceCopy;
  request: Request;
  url: URL;
}) {
  const userCode = normalizeUserCode(code);
  const record = await prisma.deviceCode.findUnique({
    where: { userCode },
    select: {
      userCode: true,
      scopes: true,
      status: true,
      expiresAt: true,
      client: {
        select: {
          clientId: true,
          disabled: true,
          name: true,
        },
      },
    },
  });

  if (!record) {
    return {
      state: "error",
      title: copy.deviceCodeNotFoundTitle,
      reason: "not_found",
      copy,
    };
  }

  const failureReason = getDeviceApprovalFailureReason(record);
  if (failureReason === "disabled") {
    return {
      state: "error",
      title: copy.deviceErrorTitle,
      reason: "invalid_or_expired",
      copy,
    };
  }

  if (failureReason === "expired") {
    return {
      state: "error",
      title: copy.deviceCodeExpiredTitle,
      reason: "expired",
      copy,
    };
  }

  if (failureReason === "used") {
    return {
      state: "error",
      title: copy.deviceCodeUsedTitle,
      reason: "used",
      status: record.status,
      copy,
    };
  }

  await requireDeviceUserId(request, callbackPath(url));

  return {
    state: "approval",
    request: {
      userCode: record.userCode,
      clientName: record.client.name ?? record.client.clientId,
      scopes: record.scopes,
    },
    copy,
  };
}
