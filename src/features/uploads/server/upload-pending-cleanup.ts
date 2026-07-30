import { Prisma } from "@/generated/prisma-node/client";
import { logAppEvent } from "@/lib/log/app-logger";
import { deleteStorageObject } from "@/lib/storage/r2-object";

export const UPLOAD_PENDING_CLEANUP_BATCH_SIZE = 25;
export const UPLOAD_PENDING_CLEANUP_LEASE_SECONDS = 120;
export const UPLOAD_PENDING_CLEANUP_RETRY_LEASE_SECONDS = 300;

type UploadPendingCleanupClient = Pick<Prisma.TransactionClient, "$queryRaw">;

type ClaimedUploadPendingCleanupRow = {
  attemptId: string;
  id: string;
  key: string;
  userId: string;
};

export type UploadPendingCleanupReport = {
  claimed: number;
  completed: number;
  failed: number;
  retried: number;
  skipped: number;
};

export async function cleanupStaleUploadPendingStorage(
  prisma: UploadPendingCleanupClient,
  now = new Date(),
): Promise<UploadPendingCleanupReport> {
  const claimed = await prisma.$queryRaw<ClaimedUploadPendingCleanupRow[]>(
    Prisma.sql`
      SELECT *
      FROM public.claim_upload_pending_storage_cleanup(
        ${now},
        ${UPLOAD_PENDING_CLEANUP_BATCH_SIZE},
        ${UPLOAD_PENDING_CLEANUP_LEASE_SECONDS}
      )
    `,
  );

  const report: UploadPendingCleanupReport = {
    claimed: claimed.length,
    completed: 0,
    failed: 0,
    retried: 0,
    skipped: 0,
  };

  for (const row of claimed) {
    try {
      const storageDeleted = await deleteUploadPendingStorageObject(row.key);
      if (!storageDeleted) {
        if (await releaseUploadPendingCleanupClaim(prisma, row, now)) {
          report.retried += 1;
        } else {
          report.skipped += 1;
        }
        continue;
      }

      if (await finalizeUploadPendingCleanupClaim(prisma, row)) {
        report.completed += 1;
        logAppEvent("info", "Upload pending storage cleanup completed", {
          source: "upload-pending-cleanup",
          key: row.key,
          userId: row.userId,
        });
      } else {
        report.skipped += 1;
      }
    } catch (error) {
      if (await releaseUploadPendingCleanupClaim(prisma, row, now)) {
        report.retried += 1;
      } else {
        report.failed += 1;
      }
      logAppEvent(
        "error",
        "Upload pending storage cleanup failed",
        {
          source: "upload-pending-cleanup",
          key: row.key,
          userId: row.userId,
        },
        error,
      );
    }
  }

  return report;
}

async function finalizeUploadPendingCleanupClaim(
  prisma: UploadPendingCleanupClient,
  row: ClaimedUploadPendingCleanupRow,
) {
  const [result] = await prisma.$queryRaw<Array<{ finalized: boolean }>>(
    Prisma.sql`
      SELECT public.finalize_upload_pending_storage_cleanup(
        ${row.id},
        ${row.attemptId}
      ) AS finalized
    `,
  );
  return result?.finalized === true;
}

async function releaseUploadPendingCleanupClaim(
  prisma: UploadPendingCleanupClient,
  row: ClaimedUploadPendingCleanupRow,
  now: Date,
) {
  const [result] = await prisma.$queryRaw<Array<{ released: boolean }>>(
    Prisma.sql`
      SELECT public.release_upload_pending_storage_cleanup(
        ${row.id},
        ${row.attemptId},
        ${now},
        ${UPLOAD_PENDING_CLEANUP_RETRY_LEASE_SECONDS}
      ) AS released
    `,
  );
  return result?.released === true;
}

async function deleteUploadPendingStorageObject(key: string) {
  try {
    await deleteStorageObject(key);
    return true;
  } catch (error) {
    logAppEvent(
      "warn",
      "Upload pending storage cleanup could not delete object",
      {
        source: "upload-pending-cleanup",
        key,
      },
      error,
    );
    return false;
  }
}
