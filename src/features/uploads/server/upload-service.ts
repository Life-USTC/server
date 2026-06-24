import { canViewerAccessCommentAttachment } from "@/features/comments/server/comment-attachment-access";
import { uploadConfig } from "@/features/uploads/lib/upload-config";
import { normalizeContentType } from "@/features/uploads/lib/upload-utils";
import {
  runUploadSerializableTransaction,
  UploadError,
} from "@/features/uploads/server/upload-quota";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { prisma } from "@/lib/db/prisma";
import {
  deleteStorageObject,
  headStorageObject,
} from "@/lib/storage/r2-object";
import { buildUploadKey } from "@/lib/storage/upload-key";

export const MAX_UPLOAD_EXPIRES_SECONDS = 300;

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

type UploadUsagePrisma = {
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
    deleteMany: (input: {
      where: { userId: string; expiresAt: { lt: Date } };
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

type PublicUpload = {
  createdAt: Date | string;
  filename: string;
  id: string;
  key: string;
  size: number;
};

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

export async function createUploadSession(input: {
  origin: string;
  upload: UploadCreateInput;
  userId: string;
}) {
  const now = new Date();
  await deleteExpiredPendingUploads(prisma, input.userId, now);

  const key = buildUploadKey(input.userId);
  const expiresAt = new Date(Date.now() + MAX_UPLOAD_EXPIRES_SECONDS * 1000);

  const reservation = await runUploadSerializableTransaction(async (tx) => {
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
        contentType: input.upload.contentType,
        expiresAt,
        filename: input.upload.filename,
        key,
        size: input.upload.size,
        userId: input.userId,
      },
    });

    return { usedBytes };
  }, "Failed to reserve upload quota");

  const uploadUrl = new URL("/api/uploads/object", input.origin);
  uploadUrl.searchParams.set("key", key);

  return {
    key,
    url: uploadUrl.toString(),
    maxFileSizeBytes: uploadConfig.maxFileSizeBytes,
    quotaBytes: uploadConfig.totalQuotaBytes,
    usedBytes: reservation.usedBytes,
  };
}

export async function completeUploadSession(
  userId: string,
  input: UploadCompleteInput,
) {
  const now = new Date();
  await deleteExpiredPendingUploads(prisma, userId, now);
  if (!uploadKeyBelongsToUser(input.key, userId)) {
    throw new UploadError("Upload session expired");
  }

  const existing = await prisma.upload.findUnique({
    where: { key: input.key },
  });
  if (existing) {
    if (existing.userId !== userId) {
      throw new UploadError("Upload session expired");
    }
    await prisma.uploadPending.deleteMany({
      where: { key: input.key, userId },
    });
    const usedBytes = await getUploadUsedBytes({ prisma, userId, now });
    return uploadUsagePayload(existing, usedBytes || existing.size);
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

  return uploadUsagePayload(reservation.upload, reservation.usedBytes);
}

export async function listUploads(userId: string) {
  const now = new Date();
  await deleteExpiredPendingUploads(prisma, userId, now);

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

  return {
    maxFileSizeBytes: uploadConfig.maxFileSizeBytes,
    quotaBytes: uploadConfig.totalQuotaBytes,
    uploads: uploads.map(publicUploadPayload),
    usedBytes,
  };
}

export async function renameUpload(input: {
  filename: string;
  id: string;
  userId: string;
}) {
  const upload = await prisma.upload.findFirst({
    where: { id: input.id, userId: input.userId },
    select: { id: true },
  });

  if (!upload) return null;

  const updated = await prisma.upload.update({
    where: { id: upload.id },
    data: { filename: input.filename },
    select: managedUploadSelect,
  });

  return publicUploadPayload(updated);
}

export async function deleteUploadRecord(input: {
  id: string;
  userId: string;
}) {
  const upload = await prisma.upload.findFirst({
    where: { id: input.id, userId: input.userId },
    select: { id: true, key: true, size: true },
  });

  if (!upload) return null;

  await prisma.upload.delete({ where: { id: upload.id } });
  return upload;
}

export async function findDownloadableUpload(id: string, userId: string) {
  const [viewer, upload] = await Promise.all([
    getViewerContext({ includeAdmin: true, userId }),
    prisma.upload.findUnique({
      where: { id },
      select: {
        contentType: true,
        filename: true,
        key: true,
        userId: true,
        commentAttachments: {
          select: {
            comment: {
              select: {
                status: true,
                userId: true,
                visibility: true,
              },
            },
          },
        },
      },
    }),
  ]);
  if (!upload || !viewer.isAuthenticated) return null;
  if (upload.userId === userId) return upload;

  const canDownloadAttachedUpload = upload.commentAttachments.some(
    ({ comment }) => canViewerAccessCommentAttachment(comment, viewer),
  );
  return canDownloadAttachedUpload ? upload : null;
}

export async function validatePendingUploadObject(input: {
  key: string;
  requestContentLength: number;
  requestContentType: string | null;
  userId: string;
}) {
  const pending = await prisma.uploadPending.findUnique({
    where: { key: input.key },
    select: {
      contentType: true,
      expiresAt: true,
      size: true,
      userId: true,
    },
  });
  const now = new Date();
  if (!pending || pending.userId !== input.userId || pending.expiresAt < now) {
    throw new UploadError("Upload session expired");
  }
  if (input.requestContentLength > pending.size) {
    throw new UploadError("File too large");
  }

  return {
    contentType:
      normalizeContentType(input.requestContentType) ?? pending.contentType,
  };
}

export async function deleteUploadObject(key: string) {
  await deleteStorageObject(key);
}

async function deleteExpiredPendingUploads(
  uploadPrisma: UploadUsagePrisma,
  userId: string,
  now: Date,
) {
  await uploadPrisma.uploadPending.deleteMany({
    where: { userId, expiresAt: { lt: now } },
  });
}

async function getUploadUsedBytes(input: {
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

async function validateUploadedObject(input: {
  contentType?: string | null;
  key: string;
}) {
  const head = await headStorageObject(input.key);

  const size = head.size;
  if (!size || size <= 0) {
    throw new UploadError("Uploaded object missing");
  }

  if (size > uploadConfig.maxFileSizeBytes) {
    await deleteStorageObject(input.key);
    throw new UploadError("File too large");
  }

  return {
    contentType: normalizeContentType(input.contentType) ?? head.contentType,
    size,
  };
}

function uploadUsagePayload(upload: PublicUpload, usedBytes: number) {
  return {
    upload: publicUploadPayload(upload),
    usedBytes,
    quotaBytes: uploadConfig.totalQuotaBytes,
  };
}
