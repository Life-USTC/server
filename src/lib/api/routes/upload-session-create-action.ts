import { PutObjectCommand } from "@aws-sdk/client-s3";
import { uploadConfig } from "@/features/uploads/lib/upload-config";
import {
  runUploadSerializableTransaction,
  UploadError,
} from "@/features/uploads/lib/upload-quota";
import { jsonResponse } from "@/lib/api/helpers";
import { MAX_UPLOAD_EXPIRES_SECONDS } from "@/lib/api/routes/upload-route-helpers";
import {
  deleteExpiredPendingUploads,
  getUploadUsedBytes,
} from "@/lib/api/routes/upload-session-helpers";
import type { UploadCreateInput } from "@/lib/api/routes/upload-session-types";
import { buildUploadKey, getS3Bucket, getS3SignedUrl } from "@/lib/storage/s3";

export async function createUploadSessionAction(
  userId: string,
  uploadInput: UploadCreateInput,
) {
  const { prisma } = await import("@/lib/db/prisma");
  const now = new Date();
  await deleteExpiredPendingUploads(prisma, userId, now);

  const key = buildUploadKey(userId);
  const expiresAt = new Date(Date.now() + MAX_UPLOAD_EXPIRES_SECONDS * 1000);

  const reservation = await runUploadSerializableTransaction(async (tx) => {
    const usedBytes = await getUploadUsedBytes({ prisma: tx, userId, now });
    if (usedBytes + uploadInput.size > uploadConfig.totalQuotaBytes) {
      throw new UploadError("Quota exceeded");
    }

    await tx.uploadPending.create({
      data: {
        contentType: uploadInput.contentType,
        expiresAt,
        filename: uploadInput.filename,
        key,
        size: uploadInput.size,
        userId,
      },
    });

    return { usedBytes };
  }, "Failed to reserve upload quota");

  const command = new PutObjectCommand({
    Bucket: getS3Bucket(),
    Key: key,
    ContentType: uploadInput.contentType,
  });
  const url = await getS3SignedUrl(command, {
    expiresIn: MAX_UPLOAD_EXPIRES_SECONDS,
  });

  return jsonResponse({
    key,
    url,
    maxFileSizeBytes: uploadConfig.maxFileSizeBytes,
    quotaBytes: uploadConfig.totalQuotaBytes,
    usedBytes: reservation.usedBytes,
  });
}
