import { prisma } from "@/lib/db/prisma";
import { normalizeUserCode } from "@/lib/oauth/device-code";
import { getDeviceApprovalFailureReason } from "./device-approval-validation.server";
import { requireDeviceUserId } from "./device-auth.server";
import type { DeviceCopy } from "./device-copy.server";
import { callbackPath } from "./device-url.server";

type DeviceApprovalRow = {
  clientClientId: string;
  clientDisabled: boolean;
  clientName: string | null;
  expiresAt: Date;
  resources: string[];
  scopes: string[];
  status: string;
  userCode: string;
};

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
  const rows = await prisma.$queryRaw<DeviceApprovalRow[]>`
    SELECT
      dc."userCode",
      dc."resources",
      dc."scopes",
      dc."status",
      dc."expiresAt",
      c."clientId" AS "clientClientId",
      c."disabled" AS "clientDisabled",
      c."name" AS "clientName"
    FROM "DeviceCode" dc
    JOIN "OAuthClient" c ON c."clientId" = dc."clientId"
    WHERE dc."userCode" = ${userCode}
      AND NOW() IS NOT NULL
    LIMIT 1
  `;
  const row = rows[0];
  const record = row
    ? {
        userCode: row.userCode,
        resources: row.resources,
        scopes: row.scopes,
        status: row.status,
        expiresAt: row.expiresAt,
        client: {
          clientId: row.clientClientId,
          disabled: row.clientDisabled,
          name: row.clientName,
        },
      }
    : null;

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
      resources: record.resources,
      scopes: record.scopes,
    },
    copy,
  };
}
