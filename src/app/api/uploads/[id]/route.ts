import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { sanitizeFilename } from "@/features/uploads/lib/upload-utils";
import {
  badRequest,
  handleRouteError,
  jsonResponse,
  notFound,
  parseResourceIdParam,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { uploadRenameRequestSchema } from "@/lib/api/schemas/request-schemas";
import {
  fireAuditLog,
  getAuditRequestMetadata,
} from "@/lib/audit/write-audit-log";
import { requireAuth } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";
import { getS3Bucket, sendS3 } from "@/lib/storage/s3";

export const dynamic = "force-dynamic";

/**
 * Rename one upload.
 * @pathParams resourceIdPathParamsSchema
 * @body uploadRenameRequestSchema
 * @response uploadRenameResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
async function patchRoute(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsed = await parseResourceIdParam(context.params, "upload");
  if (parsed instanceof Response) {
    return parsed;
  }
  const id = parsed;
  const parsedBody = await parseRouteJsonBody(
    request,
    uploadRenameRequestSchema,
    "Invalid update payload",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  const trimmed = sanitizeFilename(parsedBody.filename);
  if (!trimmed) {
    return badRequest("Filename required");
  }

  try {
    const upload = await prisma.upload.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!upload) {
      return notFound();
    }

    const updated = await prisma.upload.update({
      where: { id: upload.id },
      data: { filename: trimmed },
      select: {
        id: true,
        key: true,
        filename: true,
        size: true,
        createdAt: true,
      },
    });

    return jsonResponse({
      upload: {
        id: updated.id,
        key: updated.key,
        filename: updated.filename,
        size: updated.size,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    return handleRouteError("Failed to rename upload", error);
  }
}
export const PATCH = observedApiRoute(patchRoute);

/**
 * Delete one upload.
 * @pathParams resourceIdPathParamsSchema
 * @response 200:uploadDeleteResponseSchema
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
async function deleteRoute(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsed = await parseResourceIdParam(context.params, "upload");
  if (parsed instanceof Response) {
    return parsed;
  }
  const id = parsed;

  try {
    const upload = await prisma.upload.findFirst({
      where: { id, userId },
      select: { id: true, key: true, size: true },
    });

    if (!upload) {
      return notFound();
    }

    // Delete DB record first, then S3 object.
    // If S3 cleanup fails, the record is gone and the orphaned S3 object
    // is harmless (no DB reference points to it). A reverse order would
    // leave a DB record pointing at a missing S3 object.
    await prisma.upload.delete({ where: { id: upload.id } });

    try {
      await sendS3(
        new DeleteObjectCommand({ Bucket: getS3Bucket(), Key: upload.key }),
      );
    } catch (s3Error) {
      // S3 cleanup failure is non-critical — the DB record is already gone.
      handleRouteError(
        "S3 object cleanup failed after upload deletion",
        s3Error,
      );
    }

    fireAuditLog({
      action: "upload_delete",
      userId,
      targetId: upload.id,
      targetType: "upload",
      metadata: { key: upload.key, size: upload.size },
      ...getAuditRequestMetadata(request),
    });

    return jsonResponse({
      deletedId: upload.id,
      deletedSize: upload.size,
    });
  } catch (error) {
    return handleRouteError("Failed to delete upload", error);
  }
}
export const DELETE = observedApiRoute(deleteRoute);
