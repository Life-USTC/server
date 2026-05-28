"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { buildSignInRedirectUrl } from "@/lib/auth/auth-routing";
import { prisma } from "@/lib/db/prisma";
import { buildSearchParams } from "@/lib/navigation/search-params";
import { DEVICE_CODE_STATUS, normalizeUserCode } from "@/lib/oauth/device-code";

type DevicePageUrlParams = {
  code?: string;
  step?: "approve";
  result?: "approved" | "denied" | "error";
  reason?: "missing_code" | "invalid_or_expired";
};

function buildDevicePageUrl(values: DevicePageUrlParams = {}) {
  const query = buildSearchParams({ values });
  return query ? `/oauth/device?${query}` : "/oauth/device";
}

function buildDeviceCallbackUrl(rawCode: FormDataEntryValue | null) {
  if (typeof rawCode !== "string" || !rawCode.trim()) {
    return buildDevicePageUrl();
  }

  return buildDevicePageUrl({
    code: rawCode.trim(),
    step: "approve",
  });
}

export async function approveDeviceCode(formData: FormData) {
  await completeDeviceCodeDecision(formData, "approve");
}

export async function denyDeviceCode(formData: FormData) {
  await completeDeviceCodeDecision(formData, "deny");
}

async function completeDeviceCodeDecision(
  formData: FormData,
  decision: "approve" | "deny",
) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      buildSignInRedirectUrl(
        {},
        buildDeviceCallbackUrl(formData.get("userCode")),
      ),
    );
  }

  const rawCode = formData.get("userCode");
  if (typeof rawCode !== "string" || !rawCode.trim()) {
    redirect(buildDevicePageUrl({ result: "error", reason: "missing_code" }));
  }

  const userCode = normalizeUserCode(rawCode);

  const record = await prisma.deviceCode.findUnique({
    where: { userCode },
  });

  if (
    !record ||
    record.status !== DEVICE_CODE_STATUS.PENDING ||
    record.expiresAt < new Date()
  ) {
    redirect(
      buildDevicePageUrl({ result: "error", reason: "invalid_or_expired" }),
    );
  }

  const approved = decision === "approve";

  await prisma.deviceCode.update({
    where: { id: record.id },
    data: approved
      ? {
          status: DEVICE_CODE_STATUS.APPROVED,
          userId: session.user.id,
        }
      : { status: DEVICE_CODE_STATUS.DENIED },
  });

  redirect(buildDevicePageUrl({ result: approved ? "approved" : "denied" }));
}
