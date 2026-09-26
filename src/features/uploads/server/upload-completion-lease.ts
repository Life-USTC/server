import { UploadPendingPhase } from "@/generated/prisma/client";
import { withUserDbContext } from "@/lib/db/prisma";

export const UPLOAD_COMPLETION_LEASE_SECONDS = 30;

export async function claimUploadCompletionLease(userId: string, key: string) {
  const now = new Date();
  const attemptId = crypto.randomUUID();
  const claimed = await withUserDbContext(userId, (tx) =>
    tx.uploadPending.updateMany({
      where: {
        key,
        userId,
        expiresAt: { gt: now },
        OR: [
          { phase: UploadPendingPhase.uploaded },
          {
            phase: UploadPendingPhase.completing,
            leaseExpiresAt: { lte: now },
          },
        ],
      },
      data: {
        attemptId,
        phase: UploadPendingPhase.completing,
        leaseExpiresAt: new Date(
          now.getTime() + UPLOAD_COMPLETION_LEASE_SECONDS * 1000,
        ),
      },
    }),
  );
  return claimed.count === 1 ? attemptId : null;
}

export async function releaseUploadCompletionLease(
  userId: string,
  key: string,
  attemptId: string,
) {
  await withUserDbContext(userId, (tx) =>
    tx.uploadPending.updateMany({
      where: { attemptId, key, phase: UploadPendingPhase.completing, userId },
      data: { phase: UploadPendingPhase.uploaded, leaseExpiresAt: null },
    }),
  );
}
