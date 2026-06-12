import { uploadConfig } from "@/features/uploads/lib/upload-config";
import { normalizeContentType } from "@/features/uploads/lib/upload-utils";
import { badRequest, payloadTooLarge } from "@/lib/api/helpers";
import {
  parseFileSize,
  publicUploadPayload,
} from "@/lib/api/routes/upload-route-helpers";

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

type UploadPublicRecord = {
  createdAt: Date | string;
  filename: string;
  id: string;
  key: string;
  size: number;
};

export function parseUploadCreateInput(parsedBody: {
  contentType?: unknown;
  filename: string;
  size: unknown;
}) {
  const filename = parsedBody.filename;
  if (!filename.trim()) {
    return badRequest("Filename is required");
  }

  const size = parseFileSize(parsedBody.size);
  if (!size || size <= 0) {
    return badRequest("Invalid file size");
  }

  if (size > uploadConfig.maxFileSizeBytes) {
    return payloadTooLarge("File too large");
  }

  return {
    contentType: normalizeContentType(parsedBody.contentType),
    filename,
    size,
  };
}

export function uploadKeyBelongsToUser(key: string, userId: string) {
  return key.startsWith(`uploads/${userId}/`);
}

export async function deleteExpiredPendingUploads(
  prisma: UploadUsagePrisma,
  userId: string,
  now: Date,
) {
  await prisma.uploadPending.deleteMany({
    where: { userId, expiresAt: { lt: now } },
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

export function uploadUsagePayload(
  upload: UploadPublicRecord,
  usedBytes: number,
) {
  return {
    upload: publicUploadPayload(upload),
    usedBytes,
    quotaBytes: uploadConfig.totalQuotaBytes,
  };
}
