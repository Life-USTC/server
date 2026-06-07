import { PutObjectCommand } from "@aws-sdk/client-s3";
import { uploadConfig } from "@/features/uploads/lib/upload-config";
import {
  runUploadSerializableTransaction,
  UploadError,
} from "@/features/uploads/lib/upload-quota";
import { normalizeContentType } from "@/features/uploads/lib/upload-utils";
import {
  badRequest,
  handleRouteError,
  jsonResponse,
  parseInteger,
  parseRouteJsonBody,
  payloadTooLarge,
} from "@/lib/api/helpers";
import { uploadCreateRequestSchema } from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";
import { buildUploadKey, getS3Bucket, getS3SignedUrl } from "@/lib/storage/s3";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_EXPIRES_SECONDS = 300;

function parseFileSize(value: unknown) {
  return parseInteger(value);
}

/**
 * List uploads of current user.
 * @response uploadsListResponseSchema
 */
async function getRoute(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  try {
    const now = new Date();
    await prisma.uploadPending.deleteMany({
      where: { userId, expiresAt: { lt: now } },
    });

    const [uploads, usage, pendingUsage] = await Promise.all([
      prisma.upload.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          key: true,
          filename: true,
          size: true,
          createdAt: true,
        },
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

    return jsonResponse({
      maxFileSizeBytes: uploadConfig.maxFileSizeBytes,
      quotaBytes: uploadConfig.totalQuotaBytes,
      uploads: uploads.map((upload) => ({
        id: upload.id,
        key: upload.key,
        filename: upload.filename,
        size: upload.size,
        createdAt: upload.createdAt,
      })),
      usedBytes,
    });
  } catch (error) {
    return handleRouteError("Failed to list uploads", error);
  }
}
export const GET = observedApiRoute(getRoute);

/**
 * Create a signed upload URL.
 * @body uploadCreateRequestSchema
 * @response uploadCreateResponseSchema
 * @response 400:openApiErrorSchema
 */
async function postRoute(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsedBody = await parseRouteJsonBody(
    request,
    uploadCreateRequestSchema,
    "Invalid upload request",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

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

  try {
    const now = new Date();
    await prisma.uploadPending.deleteMany({
      where: { userId, expiresAt: { lt: now } },
    });

    const contentType = normalizeContentType(parsedBody.contentType);
    const key = buildUploadKey(userId);
    const expiresAt = new Date(Date.now() + MAX_UPLOAD_EXPIRES_SECONDS * 1000);

    const reservation = await runUploadSerializableTransaction(async (tx) => {
      const [usage, pendingUsage] = await Promise.all([
        tx.upload.aggregate({
          where: { userId },
          _sum: { size: true },
        }),
        tx.uploadPending.aggregate({
          where: { userId, expiresAt: { gt: now } },
          _sum: { size: true },
        }),
      ]);

      const usedBytes = (usage._sum.size ?? 0) + (pendingUsage._sum.size ?? 0);
      if (usedBytes + size > uploadConfig.totalQuotaBytes) {
        throw new UploadError("Quota exceeded");
      }

      await tx.uploadPending.create({
        data: {
          contentType,
          expiresAt,
          filename,
          key,
          size,
          userId,
        },
      });

      return { usedBytes };
    }, "Failed to reserve upload quota");

    const command = new PutObjectCommand({
      Bucket: getS3Bucket(),
      Key: key,
      ContentType: contentType,
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
  } catch (error) {
    if (error instanceof UploadError) {
      return badRequest(error.code);
    }
    return handleRouteError("Failed to create upload", error);
  }
}
export const POST = observedApiRoute(postRoute);
