import { DEVICE_CODE_STATUS, normalizeUserCode } from "@/lib/oauth/device-code";
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
  const { prisma } = await import("@/lib/db/prisma");
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

  if (record.expiresAt < new Date()) {
    return {
      state: "error",
      title: copy.deviceCodeExpiredTitle,
      reason: "expired",
      copy,
    };
  }

  if (record.status !== DEVICE_CODE_STATUS.PENDING) {
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
