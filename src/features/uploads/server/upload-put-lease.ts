/** Pending upload PUT lease claim and object validation. */
import { normalizeContentType } from "@/features/uploads/lib/upload-utils";
import { UploadError } from "@/features/uploads/server/upload-quota";
import { UploadPendingPhase } from "@/generated/prisma/client";
import { withUserDbContext } from "@/lib/db/prisma";
import { UPLOAD_PUT_LEASE_SECONDS } from "./upload-service-shared";

export async function claimUploadPutLease(input: {
  key: string;
  requestContentLength: number;
  requestContentType: string | null;
  userId: string;
}) {
  const now = new Date();
  const leaseExpiresAt = new Date(
    now.getTime() + UPLOAD_PUT_LEASE_SECONDS * 1000,
  );
  const claimed = await withUserDbContext(input.userId, async (tx) => {
    const updated = await tx.uploadPending.updateMany({
      where: {
        key: input.key,
        userId: input.userId,
        expiresAt: { gt: now },
        phase: {
          in: [UploadPendingPhase.reserved, UploadPendingPhase.uploaded],
        },
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
      },
      data: {
        leaseExpiresAt,
        phase: UploadPendingPhase.uploading,
      },
    });
    if (updated.count === 0) {
      return null;
    }

    return tx.uploadPending.findUnique({
      where: { key: input.key },
      select: {
        attemptId: true,
        contentType: true,
        size: true,
      },
    });
  });

  if (!claimed) {
    throw new UploadError("Upload session expired");
  }
  if (input.requestContentLength > claimed.size) {
    throw new UploadError("File too large");
  }

  return {
    attemptId: claimed.attemptId,
    contentType:
      normalizeContentType(input.requestContentType) ?? claimed.contentType,
  };
}

export async function markUploadPutCompleted(input: {
  attemptId: string;
  key: string;
  userId: string;
}) {
  const updated = await withUserDbContext(input.userId, (tx) =>
    tx.uploadPending.updateMany({
      where: {
        attemptId: input.attemptId,
        key: input.key,
        phase: UploadPendingPhase.uploading,
        userId: input.userId,
      },
      data: {
        leaseExpiresAt: null,
        phase: UploadPendingPhase.uploaded,
      },
    }),
  );

  if (updated.count === 0) {
    throw new UploadError("Upload session expired");
  }
}

export async function validatePendingUploadObject(input: {
  key: string;
  requestContentLength: number;
  requestContentType: string | null;
  userId: string;
}) {
  return claimUploadPutLease(input);
}
