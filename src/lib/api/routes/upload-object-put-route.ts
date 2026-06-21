import { uploadConfig } from "@/features/uploads/lib/upload-config";
import { UploadError } from "@/features/uploads/server/upload-quota";
import {
  uploadKeyBelongsToUser,
  validatePendingUploadObject,
} from "@/features/uploads/server/upload-service";
import {
  badRequest,
  forbidden,
  handleRouteError,
  jsonResponse,
  payloadTooLarge,
} from "@/lib/api/helpers";
import { requireWriteAuth } from "@/lib/auth/api-auth";
import { putStorageObject } from "@/lib/storage/r2-object";

function contentLength(request: Request) {
  const value = request.headers.get("content-length");
  if (!value || !/^\d+$/.test(value)) return null;
  return Number(value);
}

export async function putUploadObjectRoute(request: Request) {
  const auth = await requireWriteAuth(request);
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
    const object = await validatePendingUploadObject({
      key,
      requestContentLength: requestSize,
      requestContentType: request.headers.get("content-type"),
      userId,
    });

    await putStorageObject({
      body: request.body,
      contentType: object.contentType,
      key,
    });

    return jsonResponse({ success: true });
  } catch (error) {
    if (error instanceof UploadError) {
      if (error.code === "File too large") {
        return payloadTooLarge(error.code);
      }
      if (error.code === "Upload session expired") {
        return badRequest(error.code);
      }
    }
    return handleRouteError("Failed to upload object", error);
  }
}
