import { redirect } from "@sveltejs/kit";
import { DEVICE_CODE_STATUS, normalizeUserCode } from "@/lib/oauth/device-code";
import { requireDeviceUserId } from "./device-auth.server";
import {
  buildDeviceCallbackUrl,
  buildDevicePageUrl,
} from "./device-url.server";

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

  const { prisma } = await import("@/lib/db/prisma");
  const userCode = normalizeUserCode(rawCode);
  const record = await prisma.deviceCode.findUnique({
    where: { userCode },
    select: {
      id: true,
      status: true,
      expiresAt: true,
    },
  });

  if (
    !record ||
    record.status !== DEVICE_CODE_STATUS.PENDING ||
    record.expiresAt < new Date()
  ) {
    throw redirect(
      303,
      buildDevicePageUrl({ result: "error", reason: "invalid_or_expired" }),
    );
  }

  const approved = decision === "approve";
  await prisma.deviceCode.update({
    where: { id: record.id },
    data: approved
      ? { status: DEVICE_CODE_STATUS.APPROVED, userId }
      : { status: DEVICE_CODE_STATUS.DENIED },
  });

  throw redirect(
    303,
    buildDevicePageUrl({ result: approved ? "approved" : "denied" }),
  );
}
