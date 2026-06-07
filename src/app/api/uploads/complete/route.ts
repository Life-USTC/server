import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { uploadConfig } from "@/features/uploads/lib/upload-config";
import {
  runUploadSerializableTransaction,
  UploadError,
} from "@/features/uploads/lib/upload-quota";
import { normalizeContentType } from "@/features/uploads/lib/upload-utils";
import {
  badRequest,
  forbidden,
  handleRouteError,
  jsonResponse,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { uploadCompleteRequestSchema } from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";
import { getS3Bucket, sendS3 } from "@/lib/storage/s3";

export const dynamic = "force-dynamic";

/**
 * Finalize one upload after S3 put.
 * @body uploadCompleteRequestSchema
 * @response uploadCompleteResponseSchema
 * @response 400:openApiErrorSchema
 */
async function postRoute(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsedBody = await parseRouteJsonBody(
    request,
    uploadCompleteRequestSchema,
    "Invalid upload completion payload",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  const { key, filename } = parsedBody;

  if (!key || !filename) {
    return badRequest("Missing upload data");
  }

  const expectedPrefix = `uploads/${userId}/`;
  if (!key.startsWith(expectedPrefix)) {
    return forbidden();
  }

  try {
    const now = new Date();
    await prisma.uploadPending.deleteMany({
      where: { userId, expiresAt: { lt: now } },
    });

    const existing = await prisma.upload.findUnique({ where: { key } });
    if (existing) {
      await prisma.uploadPending.deleteMany({ where: { key } });
      const [usage, pendingUsage] = await Promise.all([
        prisma.upload.aggregate({
          where: { userId },
          _sum: { size: true },
        }),
        prisma.uploadPending.aggregate({
          where: { userId, expiresAt: { gt: now } },
          _sum: { size: true },
        }),
      ]);

      const usedBytes =
        (usage._sum.size ?? existing.size) + (pendingUsage._sum.size ?? 0);

      return jsonResponse({
        upload: {
          id: existing.id,
          key: existing.key,
          filename: existing.filename,
          size: existing.size,
          createdAt: existing.createdAt,
        },
        usedBytes,
        quotaBytes: uploadConfig.totalQuotaBytes,
      });
    }

    // Move all checks inside the serializable transaction for consistency.
    const reservation = await runUploadSerializableTransaction(async (tx) => {
      const pending = await tx.uploadPending.findUnique({ where: { key } });
      if (!pending || pending.userId !== userId) {
        throw new UploadError("Upload session expired");
      }

      if (pending.expiresAt < now) {
        await tx.uploadPending.delete({ where: { key } });
        throw new UploadError("Upload session expired");
      }

      // S3 HeadObject check must happen outside the transaction boundary
      // since it's an external service call — we verify the file exists
      // before committing quota changes.
      const bucket = getS3Bucket();
      const head = await sendS3(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );

      const size = head.ContentLength ?? 0;
      if (!size || size <= 0) {
        throw new UploadError("Uploaded object missing");
      }

      if (size > uploadConfig.maxFileSizeBytes) {
        await sendS3(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        throw new UploadError("File too large");
      }

      const contentType =
        normalizeContentType(parsedBody.contentType) ?? head.ContentType;

      const [usage, pendingUsage] = await Promise.all([
        tx.upload.aggregate({
          where: { userId },
          _sum: { size: true },
        }),
        tx.uploadPending.aggregate({
          where: {
            userId,
            expiresAt: { gt: now },
            NOT: { key },
          },
          _sum: { size: true },
        }),
      ]);

      const usedBytes = (usage._sum.size ?? 0) + (pendingUsage._sum.size ?? 0);
      if (usedBytes + size > uploadConfig.totalQuotaBytes) {
        await tx.uploadPending.delete({ where: { key } });
        throw new UploadError("Quota exceeded");
      }

      const upload = await tx.upload.create({
        data: {
          contentType,
          filename,
          key,
          size,
          userId,
        },
      });

      await tx.uploadPending.delete({ where: { key } });

      return { upload, usedBytes: usedBytes + size };
    }, "Failed to finalize upload quota");

    return jsonResponse({
      upload: {
        id: reservation.upload.id,
        key: reservation.upload.key,
        filename: reservation.upload.filename,
        size: reservation.upload.size,
        createdAt: reservation.upload.createdAt,
      },
      usedBytes: reservation.usedBytes,
      quotaBytes: uploadConfig.totalQuotaBytes,
    });
  } catch (error) {
    if (error instanceof UploadError) {
      if (
        error.code === "Quota exceeded" ||
        error.code === "Upload session expired"
      ) {
        await sendS3(
          new DeleteObjectCommand({ Bucket: getS3Bucket(), Key: key }),
        );
      }
      return badRequest(error.code);
    }
    return handleRouteError("Failed to finalize upload", error);
  }
}
export const POST = observedApiRoute(postRoute);
