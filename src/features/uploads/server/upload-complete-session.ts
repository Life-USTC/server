/** Finalize pending uploads into durable upload records. */
import { uploadConfig } from "@/features/uploads/lib/upload-config";
import { UploadError } from "@/features/uploads/server/upload-quota";
import { UploadPendingPhase } from "@/generated/prisma/client";
import { withUserDbContext } from "@/lib/db/prisma";
import {
  assertActivePendingUpload,
  deleteExpiredPendingUploads,
  findExistingUploadUsagePayload,
  getUploadUsedBytes,
  requireActiveUploadWriter,
  runOwnedUploadSerializableTransaction,
  type UploadCompleteInput,
  type UploadCompletionResult,
  uploadKeyBelongsToUser,
  uploadUsagePayload,
  validateUploadedObject,
} from "./upload-service-shared";

export type { UploadCompleteInput } from "./upload-service-shared";

export async function completeUploadSession(
  userId: string,
  input: UploadCompleteInput,
) {
  const now = new Date();
  await withUserDbContext(userId, (tx) =>
    deleteExpiredPendingUploads(tx, userId, now, input.key),
  );
  if (!uploadKeyBelongsToUser(input.key, userId)) {
    throw new UploadError("Upload session expired");
  }

  const existing = await withUserDbContext(userId, (tx) =>
    findExistingUploadUsagePayload(tx, input.key, userId, now),
  );
  if (existing) return existing;

  try {
    await withUserDbContext(userId, (tx) =>
      assertActivePendingUpload(tx, {
        key: input.key,
        now,
        userId,
      }),
    );
  } catch (error) {
    if (error instanceof UploadError) {
      const completed = await withUserDbContext(userId, (tx) =>
        findExistingUploadUsagePayload(tx, input.key, userId, new Date()),
      );
      if (completed) return completed;
    }
    throw error;
  }

  const uploadedObject = await validateUploadedObject(input);

  const reservation = await runOwnedUploadSerializableTransaction(
    userId,
    async (tx) => {
      const completed = await tx.upload.findUnique({
        where: { key: input.key },
      });
      if (completed) {
        if (completed.userId !== userId) {
          return {
            ok: false,
            code: "Upload session expired",
          } satisfies UploadCompletionResult;
        }
        await tx.uploadPending.deleteMany({
          where: { key: input.key, userId },
        });
        const usedBytes = await getUploadUsedBytes({
          prisma: tx,
          userId,
          now: new Date(),
        });
        return {
          ok: true,
          upload: completed,
          usedBytes: usedBytes || completed.size,
        } satisfies UploadCompletionResult;
      }

      const pending = await tx.uploadPending.findUnique({
        where: { key: input.key },
      });
      if (!pending || pending.userId !== userId) {
        return {
          ok: false,
          code: "Upload session expired",
        } satisfies UploadCompletionResult;
      }

      const transactionNow = new Date();
      if (pending.expiresAt < transactionNow) {
        return {
          ok: false,
          code: "Upload session expired",
        } satisfies UploadCompletionResult;
      }

      if (pending.phase !== UploadPendingPhase.uploaded) {
        return {
          ok: false,
          code: "Upload session expired",
        } satisfies UploadCompletionResult;
      }

      const completing = await tx.uploadPending.updateMany({
        where: {
          key: input.key,
          userId,
          phase: UploadPendingPhase.uploaded,
        },
        data: {
          phase: UploadPendingPhase.completing,
          leaseExpiresAt: new Date(transactionNow.getTime() + 30_000),
        },
      });
      if (completing.count === 0) {
        return {
          ok: false,
          code: "Upload session expired",
        } satisfies UploadCompletionResult;
      }

      const usedBytes = await getUploadUsedBytes({
        excludePendingKey: input.key,
        prisma: tx,
        userId,
        now: transactionNow,
      });
      if (usedBytes + uploadedObject.size > uploadConfig.totalQuotaBytes) {
        await tx.uploadPending.updateMany({
          where: {
            key: input.key,
            userId,
            expiresAt: { gte: transactionNow },
          },
          data: { expiresAt: new Date(transactionNow.getTime() - 1) },
        });
        return {
          ok: false,
          code: "Quota exceeded",
        } satisfies UploadCompletionResult;
      }

      const upload = await tx.upload.create({
        data: {
          contentType: uploadedObject.contentType,
          filename: input.filename,
          key: input.key,
          size: uploadedObject.size,
          userId,
        },
      });

      await tx.uploadPending.deleteMany({ where: { key: input.key, userId } });

      return {
        ok: true,
        upload,
        usedBytes: usedBytes + uploadedObject.size,
      } satisfies UploadCompletionResult;
    },
    "Failed to finalize upload quota",
  );

  if (!reservation.ok) {
    throw new UploadError(reservation.code);
  }

  return uploadUsagePayload(reservation.upload, reservation.usedBytes);
}

export async function completeOwnedUploadSession(
  userId: string,
  input: UploadCompleteInput,
) {
  const writer = await requireActiveUploadWriter(userId);
  if (!writer.ok) return writer;
  if (!uploadKeyBelongsToUser(input.key, userId)) {
    return { ok: false as const, error: "forbidden" as const };
  }

  return {
    ok: true as const,
    completion: await completeUploadSession(userId, input),
  };
}
