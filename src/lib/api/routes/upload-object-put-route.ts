import { uploadConfig } from "@/features/uploads/lib/upload-config";
import { normalizeContentType } from "@/features/uploads/lib/upload-utils";
import {
  badRequest,
  forbidden,
  handleRouteError,
  jsonResponse,
  payloadTooLarge,
} from "@/lib/api/helpers";
import { uploadKeyBelongsToUser } from "@/lib/api/routes/upload-session-helpers";
import { requireAuth } from "@/lib/auth/api-auth";
import { putStorageObject } from "@/lib/storage/r2-object";

function contentLength(request: Request) {
  const value = request.headers.get("content-length");
  if (!value || !/^\d+$/.test(value)) return null;
  return Number(value);
}

export async function putUploadObjectRoute(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) return badRequest("Missing upload key");
  if (!uploadKeyBelongsToUser(key, userId)) return forbidden();
  if (!request.body) return badRequest("Missing upload body");

  const requestSize = contentLength(request);
  if (requestSize == null) return badRequest("Missing content length");
  if (requestSize > uploadConfig.maxFileSizeBytes) {
    return payloadTooLarge("File too large");
  }

  try {
    const { prisma } = await import("@/lib/db/prisma");
    const pending = await prisma.uploadPending.findUnique({
      where: { key },
      select: {
        contentType: true,
        expiresAt: true,
        size: true,
        userId: true,
      },
    });
    const now = new Date();
    if (!pending || pending.userId !== userId || pending.expiresAt < now) {
      return badRequest("Upload session expired");
    }
    if (requestSize > pending.size) {
      return payloadTooLarge("File too large");
    }

    await putStorageObject({
      body: request.body,
      contentType:
        normalizeContentType(request.headers.get("content-type")) ??
        pending.contentType,
      key,
    });

    return jsonResponse({ success: true });
  } catch (error) {
    return handleRouteError("Failed to upload object", error);
  }
}
