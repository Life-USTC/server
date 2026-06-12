import { uploadConfig } from "@/features/uploads/lib/upload-config";
import {
  runUploadSerializableTransaction,
  UploadError,
} from "@/features/uploads/lib/upload-quota";
import { jsonResponse } from "@/lib/api/helpers";
import {
  deleteExpiredPendingUploads,
  getUploadUsedBytes,
  uploadUsagePayload,
} from "@/lib/api/routes/upload-session-helpers";
import type { UploadCompleteInput } from "@/lib/api/routes/upload-session-types";
import { validateUploadedObject } from "./upload-object-validation";

export async function completeUploadSessionAction(
  userId: string,
  input: UploadCompleteInput,
) {
  const { prisma } = await import("@/lib/db/prisma");
  const now = new Date();
  await deleteExpiredPendingUploads(prisma, userId, now);

  const existing = await prisma.upload.findUnique({
    where: { key: input.key },
  });
  if (existing) {
    await prisma.uploadPending.deleteMany({ where: { key: input.key } });
    const usedBytes = await getUploadUsedBytes({ prisma, userId, now });
    return jsonResponse(
      uploadUsagePayload(existing, usedBytes || existing.size),
    );
  }

  const reservation = await runUploadSerializableTransaction(async (tx) => {
    const pending = await tx.uploadPending.findUnique({
      where: { key: input.key },
    });
    if (!pending || pending.userId !== userId) {
      throw new UploadError("Upload session expired");
    }

    if (pending.expiresAt < now) {
      await tx.uploadPending.delete({ where: { key: input.key } });
      throw new UploadError("Upload session expired");
    }

    const { contentType, size } = await validateUploadedObject(input);

    const usedBytes = await getUploadUsedBytes({
      excludePendingKey: input.key,
      prisma: tx,
      userId,
      now,
    });
    if (usedBytes + size > uploadConfig.totalQuotaBytes) {
      await tx.uploadPending.delete({ where: { key: input.key } });
      throw new UploadError("Quota exceeded");
    }

    const upload = await tx.upload.create({
      data: {
        contentType,
        filename: input.filename,
        key: input.key,
        size,
        userId,
      },
    });

    await tx.uploadPending.delete({ where: { key: input.key } });

    return { upload, usedBytes: usedBytes + size };
  }, "Failed to finalize upload quota");

  return jsonResponse(
    uploadUsagePayload(reservation.upload, reservation.usedBytes),
  );
}
