import { redirect } from "@sveltejs/kit";
import { prisma } from "@/lib/db/prisma";
import { DEVICE_CODE_STATUS, normalizeUserCode } from "@/lib/oauth/device-code";
import { getDeviceApprovalFailureReason } from "./device-approval-validation.server";
import { requireDeviceUserId } from "./device-auth.server";
import {
  buildDeviceCallbackUrl,
  buildDevicePageUrl,
} from "./device-url.server";

type DeviceDecisionRow = {
  clientDisabled: boolean;
  expiresAt: Date;
  id: string;
  status: string;
};

export async function completeDeviceCodeDecision(
  request: Request,
  formData: FormData,
  decision: "approve" | "deny",
) {
  const userId = await requireDeviceUserId(
    request,
    buildDeviceCallbackUrl(formData.get("userCode")),
  );
  const rawCode = formData.get("userCode");
  if (typeof rawCode !== "string" || !rawCode.trim()) {
    throw redirect(
      303,
      buildDevicePageUrl({ result: "error", reason: "missing_code" }),
    );
  }

  const userCode = normalizeUserCode(rawCode);
  const now = new Date();
  const rows = await prisma.$queryRaw<DeviceDecisionRow[]>`
    SELECT
      dc."id",
      dc."status",
      dc."expiresAt",
      c."disabled" AS "clientDisabled"
    FROM "DeviceCode" dc
    JOIN "OAuthClient" c ON c."clientId" = dc."clientId"
    WHERE dc."userCode" = ${userCode}
      AND NOW() IS NOT NULL
    LIMIT 1
  `;
  const row = rows[0];
  const record = row
    ? {
        id: row.id,
        status: row.status,
        expiresAt: row.expiresAt,
        client: { disabled: row.clientDisabled },
      }
    : null;

  if (!record || getDeviceApprovalFailureReason(record, now)) {
    throw redirect(
      303,
      buildDevicePageUrl({ result: "error", reason: "invalid_or_expired" }),
    );
  }

  const approved = decision === "approve";
  const updated = approved
    ? await prisma.$queryRaw<{ id: string }[]>`
        UPDATE "DeviceCode"
        SET "status" = ${DEVICE_CODE_STATUS.APPROVED}, "userId" = ${userId}
        WHERE "id" = ${record.id}
          AND "status" = ${DEVICE_CODE_STATUS.PENDING}
          AND "expiresAt" > ${now}
          AND EXISTS (
            SELECT 1
            FROM "OAuthClient"
            WHERE "OAuthClient"."clientId" = "DeviceCode"."clientId"
              AND "OAuthClient"."disabled" = false
          )
        RETURNING "id"
      `
    : await prisma.$queryRaw<{ id: string }[]>`
        UPDATE "DeviceCode"
        SET "status" = ${DEVICE_CODE_STATUS.DENIED}
        WHERE "id" = ${record.id}
          AND "status" = ${DEVICE_CODE_STATUS.PENDING}
          AND "expiresAt" > ${now}
          AND EXISTS (
            SELECT 1
            FROM "OAuthClient"
            WHERE "OAuthClient"."clientId" = "DeviceCode"."clientId"
              AND "OAuthClient"."disabled" = false
          )
        RETURNING "id"
      `;
  if (updated.length !== 1) {
    throw redirect(
      303,
      buildDevicePageUrl({ result: "error", reason: "invalid_or_expired" }),
    );
  }

  throw redirect(
    303,
    buildDevicePageUrl({ result: approved ? "approved" : "denied" }),
  );
}
