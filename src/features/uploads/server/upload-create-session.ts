/** Create pending upload sessions and reserve quota. */
import { uploadConfig } from "@/features/uploads/lib/upload-config";
import { UploadError } from "@/features/uploads/server/upload-quota";
import { UploadPendingPhase } from "@/generated/prisma/client";
import { withUserDbContext } from "@/lib/db/prisma";
import { buildUploadKey } from "@/lib/storage/upload-key";
import {
  deleteExpiredPendingUploads,
  getUploadUsedBytes,
  MAX_UPLOAD_EXPIRES_SECONDS,
  requireActiveUploadWriter,
  runOwnedUploadSerializableTransaction,
  type UploadCreateInput,
} from "./upload-service-shared";

export type { UploadCreateInput } from "./upload-service-shared";

export async function createUploadSession(input: {
  origin: string;
  upload: UploadCreateInput;
  userId: string;
}) {
  const now = new Date();
  await withUserDbContext(input.userId, (tx) =>
    deleteExpiredPendingUploads(tx, input.userId, now),
  );

  const key = buildUploadKey(input.userId);
  const expiresAt = new Date(Date.now() + MAX_UPLOAD_EXPIRES_SECONDS * 1000);

  const reservation = await runOwnedUploadSerializableTransaction(
    input.userId,
    async (tx) => {
      const usedBytes = await getUploadUsedBytes({
        prisma: tx,
        userId: input.userId,
        now,
      });
      if (usedBytes + input.upload.size > uploadConfig.totalQuotaBytes) {
        throw new UploadError("Quota exceeded");
      }

      await tx.uploadPending.create({
        data: {
          attemptId: crypto.randomUUID(),
          contentType: input.upload.contentType,
          expiresAt,
          filename: input.upload.filename,
          key,
          phase: UploadPendingPhase.reserved,
          size: input.upload.size,
          userId: input.userId,
        },
      });

      return { usedBytes };
    },
    "Failed to reserve upload quota",
  );

  const uploadUrl = new URL("/api/workspace/uploads/object", input.origin);
  uploadUrl.searchParams.set("key", key);

  return {
    key,
    url: uploadUrl.toString(),
    maxFileSizeBytes: uploadConfig.maxFileSizeBytes,
    quotaBytes: uploadConfig.totalQuotaBytes,
    usedBytes: reservation.usedBytes,
  };
}

export async function createOwnedUploadSession(input: {
  origin: string;
  upload: UploadCreateInput;
  userId: string;
}) {
  const writer = await requireActiveUploadWriter(input.userId);
  if (!writer.ok) return writer;

  return {
    ok: true as const,
    session: await createUploadSession(input),
  };
}
