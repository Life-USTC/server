/** Shared upload-service helpers, types, and constants. */
import { uploadConfig } from "@/features/uploads/lib/upload-config";
import { normalizeContentType } from "@/features/uploads/lib/upload-utils";
import {
  runUploadSerializableTransaction,
  UploadError,
} from "@/features/uploads/server/upload-quota";
import { type Prisma, UploadPendingPhase } from "@/generated/prisma/client";
import {
  type AuditLogParams,
  writeAuditLog,
} from "@/lib/audit/write-audit-log";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { logAppEvent } from "@/lib/log/app-logger";
import {
  deleteStorageObject,
  headStorageObject,
} from "@/lib/storage/r2-object";

export const MAX_UPLOAD_EXPIRES_SECONDS = 300;
export const EXPIRED_PENDING_UPLOAD_CLEANUP_BATCH_SIZE = 25;
export const UPLOAD_PUT_LEASE_SECONDS = 120;

export type UploadCreateInput = {
  contentType: string;
  filename: string;
  size: number;
};

export type UploadCompleteInput = {
  contentType?: string | null;
  filename: string;
  key: string;
};

export type UploadUsagePrisma = {
  upload: {
    aggregate: (input: {
      where: { userId: string };
      _sum: { size: true };
    }) => Promise<{ _sum: { size: number | null } }>;
  };
  uploadPending: {
    aggregate: (input: {
      where: {
        userId: string;
        expiresAt: { gt: Date };
        NOT?: { key: string };
      };
      _sum: { size: true };
    }) => Promise<{ _sum: { size: number | null } }>;
  };
};

export type ExpiredPendingUploadCleanupPrisma = {
  uploadPending: {
    findMany: (input: {
      where: {
        userId: string;
        expiresAt: { lt: Date };
        phase: { in: UploadPendingPhase[] };
        OR: Array<{ leaseExpiresAt: null } | { leaseExpiresAt: { lt: Date } }>;
        NOT?: { key: string };
      };
      orderBy: [{ expiresAt: "asc" }, { key: "asc" }];
      select: { key: true };
      take: number;
    }) => Promise<Array<{ key: string }>>;
    deleteMany: (input: {
      where: {
        key: { in: string[] };
        userId: string;
        expiresAt: { lt: Date };
      };
    }) => Promise<unknown>;
  };
};

export const managedUploadSelect = {
  id: true,
  key: true,
  filename: true,
  size: true,
  createdAt: true,
} as const;

export type PublicUpload = {
  createdAt: Date | string;
  filename: string;
  id: string;
  key: string;
  size: number;
};

export type UploadCompletionFailureCode =
  | "Quota exceeded"
  | "Upload session expired";

export type UploadCompletionResult =
  | { ok: true; upload: PublicUpload; usedBytes: number }
  | { ok: false; code: UploadCompletionFailureCode };

export type DownloadableUpload = {
  contentType: string | null;
  filename: string;
  key: string;
  userId: string;
};

export type UploadAuditContext = Pick<
  AuditLogParams,
  | "channel"
  | "ipAddress"
  | "oauthClientId"
  | "oauthGrantId"
  | "requestId"
  | "sessionId"
  | "subjectUserId"
  | "userAgent"
> & { source?: "graphql" | "mcp" };

export function publicUploadPayload(upload: PublicUpload) {
  return {
    id: upload.id,
    key: upload.key,
    filename: upload.filename,
    size: upload.size,
    createdAt: upload.createdAt,
  };
}

export function uploadKeyBelongsToUser(key: string, userId: string) {
  return key.startsWith(`uploads/${userId}/`);
}

export function uploadUsagePayload(upload: PublicUpload, usedBytes: number) {
  return {
    upload: publicUploadPayload(upload),
    usedBytes,
    quotaBytes: uploadConfig.totalQuotaBytes,
  };
}

export async function requireActiveUploadWriter(userId: string) {
  const viewer = await getViewerContext({ includeAdmin: true, userId });
  if (!viewer.isAuthenticated) {
    return { ok: false as const, error: "forbidden" as const };
  }
  if (viewer.isSuspended) {
    return {
      ok: false as const,
      error: "suspended" as const,
      reason: viewer.suspensionReason,
    };
  }
  return { ok: true as const };
}

export async function deleteUploadStorageObject(upload: {
  key: string;
  size: number;
}) {
  try {
    await deleteStorageObject(upload.key);
    return true;
  } catch (error) {
    try {
      const head = await headStorageObject(upload.key);
      if (upload.size > 0 && head.size <= 0) {
        return true;
      }
    } catch {
      // Preserve the upload record if storage state cannot be confirmed.
    }

    logAppEvent(
      "error",
      "R2 object deletion failed; upload record preserved",
      { source: "upload" },
      error,
    );
    return false;
  }
}

export async function writeUploadDeleteAuditLog({
  audit,
  client,
  upload,
  userId,
}: {
  audit?: UploadAuditContext;
  client: NonNullable<Parameters<typeof writeAuditLog>[1]>;
  upload: { id: string; key: string; size: number };
  userId: string;
}) {
  const { source, ...attribution } = audit ?? {};
  await writeAuditLog(
    {
      action: "upload_delete",
      ...attribution,
      userId,
      subjectUserId: attribution.subjectUserId ?? userId,
      targetId: upload.id,
      targetType: "upload",
      metadata: {
        size: upload.size,
        ...(source ? { source } : {}),
      },
    },
    client,
  );
}

export async function deleteExpiredPendingUploads(
  uploadPrisma: ExpiredPendingUploadCleanupPrisma,
  userId: string,
  now: Date,
  excludeKey?: string,
) {
  const expiredUploads = await uploadPrisma.uploadPending.findMany({
    where: {
      userId,
      expiresAt: { lt: now },
      phase: {
        in: [UploadPendingPhase.reserved, UploadPendingPhase.uploaded],
      },
      OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
      ...(excludeKey ? { NOT: { key: excludeKey } } : {}),
    },
    orderBy: [{ expiresAt: "asc" }, { key: "asc" }],
    select: { key: true },
    take: EXPIRED_PENDING_UPLOAD_CLEANUP_BATCH_SIZE,
  });
  if (expiredUploads.length === 0) return;

  await uploadPrisma.uploadPending.deleteMany({
    where: {
      key: { in: expiredUploads.map(({ key }) => key) },
      userId,
      expiresAt: { lt: now },
    },
  });
}

export async function deletePendingUpload(
  uploadPrisma: Prisma.TransactionClient,
  key: string,
  userId: string,
) {
  await uploadPrisma.uploadPending.deleteMany({
    where: { key, userId },
  });
}

export async function getUploadUsedBytes(input: {
  excludePendingKey?: string;
  now: Date;
  prisma: UploadUsagePrisma;
  userId: string;
}) {
  const [usage, pendingUsage] = await Promise.all([
    input.prisma.upload.aggregate({
      where: { userId: input.userId },
      _sum: { size: true },
    }),
    input.prisma.uploadPending.aggregate({
      where: {
        userId: input.userId,
        expiresAt: { gt: input.now },
        ...(input.excludePendingKey
          ? { NOT: { key: input.excludePendingKey } }
          : {}),
      },
      _sum: { size: true },
    }),
  ]);

  return (usage._sum.size ?? 0) + (pendingUsage._sum.size ?? 0);
}

export async function findExistingUploadUsagePayload(
  uploadPrisma: Prisma.TransactionClient,
  key: string,
  userId: string,
  now: Date,
) {
  const existing = await uploadPrisma.upload.findUnique({
    where: { key },
  });
  if (!existing) return null;
  if (existing.userId !== userId) {
    throw new UploadError("Upload session expired");
  }

  await deletePendingUpload(uploadPrisma, key, userId);
  const usedBytes = await getUploadUsedBytes({
    prisma: uploadPrisma,
    userId,
    now,
  });
  return uploadUsagePayload(existing, usedBytes || existing.size);
}

export async function assertActivePendingUpload(
  uploadPrisma: Prisma.TransactionClient,
  input: {
    key: string;
    now: Date;
    userId: string;
  },
) {
  const pending = await uploadPrisma.uploadPending.findUnique({
    where: { key: input.key },
    select: {
      expiresAt: true,
      userId: true,
    },
  });

  if (!pending || pending.userId !== input.userId) {
    throw new UploadError("Upload session expired");
  }

  if (pending.expiresAt < input.now) {
    throw new UploadError("Upload session expired");
  }
}

export async function runOwnedUploadSerializableTransaction<T>(
  userId: string,
  action: (tx: Prisma.TransactionClient) => Promise<T>,
  failureMessage: string,
) {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) throw new Error("RLS user ID is required");

  return runUploadSerializableTransaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.user_id', ${normalizedUserId}, true)`;
    return action(tx);
  }, failureMessage);
}

export async function validateUploadedObject(input: {
  contentType?: string | null;
  key: string;
}) {
  const head = await headStorageObject(input.key);

  const size = head.size;
  if (!size || size <= 0) {
    throw new UploadError("Uploaded object missing");
  }

  if (size > uploadConfig.maxFileSizeBytes) {
    throw new UploadError("File too large");
  }

  return {
    contentType: normalizeContentType(input.contentType) ?? head.contentType,
    size,
  };
}
