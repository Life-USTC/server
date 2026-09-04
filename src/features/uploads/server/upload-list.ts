/** List managed uploads and expose public list payload helpers. */
import { uploadConfig } from "@/features/uploads/lib/upload-config";
import { withUserDbContext } from "@/lib/db/prisma";
import {
  managedUploadSelect,
  publicUploadPayload,
  uploadKeyBelongsToUser,
} from "./upload-service-shared";

export { publicUploadPayload, uploadKeyBelongsToUser };

export async function listUploads(
  userId: string,
  pagination: { pageSize: number; skip: number },
) {
  const now = new Date();
  return withUserDbContext(userId, async (tx) => {
    const [uploads, total, usage, pendingUsage] = await Promise.all([
      tx.upload.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: pagination.skip,
        take: pagination.pageSize,
        select: managedUploadSelect,
      }),
      tx.upload.count({ where: { userId } }),
      tx.upload.aggregate({
        where: { userId },
        _sum: { size: true },
      }),
      tx.uploadPending.aggregate({
        where: { userId, expiresAt: { gt: now } },
        _sum: { size: true },
      }),
    ]);

    const usedBytes = (usage._sum.size ?? 0) + (pendingUsage._sum.size ?? 0);

    return {
      maxFileSizeBytes: uploadConfig.maxFileSizeBytes,
      quotaBytes: uploadConfig.totalQuotaBytes,
      total,
      uploads: uploads.map(publicUploadPayload),
      usedBytes,
    };
  });
}
