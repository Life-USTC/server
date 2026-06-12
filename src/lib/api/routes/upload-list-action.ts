import { uploadConfig } from "@/features/uploads/lib/upload-config";
import { jsonResponse } from "@/lib/api/helpers";
import { publicUploadPayload } from "@/lib/api/routes/upload-route-helpers";
import { managedUploadSelect } from "./upload-management-select";

export async function listUploadsAction(userId: string) {
  const { prisma } = await import("@/lib/db/prisma");
  const now = new Date();
  await prisma.uploadPending.deleteMany({
    where: { userId, expiresAt: { lt: now } },
  });

  const [uploads, usage, pendingUsage] = await Promise.all([
    prisma.upload.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: managedUploadSelect,
    }),
    prisma.upload.aggregate({
      where: { userId },
      _sum: { size: true },
    }),
    prisma.uploadPending.aggregate({
      where: { userId, expiresAt: { gt: now } },
      _sum: { size: true },
    }),
  ]);

  const usedBytes = (usage._sum.size ?? 0) + (pendingUsage._sum.size ?? 0);

  return jsonResponse({
    maxFileSizeBytes: uploadConfig.maxFileSizeBytes,
    quotaBytes: uploadConfig.totalQuotaBytes,
    uploads: uploads.map(publicUploadPayload),
    usedBytes,
  });
}
