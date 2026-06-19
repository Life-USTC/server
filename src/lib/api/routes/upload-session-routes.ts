import {
  completeUploadSession,
  createUploadSession,
  uploadKeyBelongsToUser,
} from "@/features/uploads/server/upload-service";
import {
  badRequest,
  forbidden,
  jsonResponse,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import {
  uploadCompleteErrorResponse,
  uploadCreateErrorResponse,
} from "@/lib/api/routes/upload-route-errors";
import { parseUploadCreateInput } from "@/lib/api/routes/upload-route-helpers";
import {
  uploadCompleteRequestSchema,
  uploadCreateRequestSchema,
} from "@/lib/api/schemas/request-schemas";
import { requireWriteAuth } from "@/lib/auth/api-auth";

export async function postUploadRoute(request: Request) {
  const auth = await requireWriteAuth(request);
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

  const uploadInput = parseUploadCreateInput(parsedBody);
  if (uploadInput instanceof Response) return uploadInput;

  try {
    const result = await createUploadSession({
      origin: new URL(request.url).origin,
      upload: uploadInput,
      userId,
    });
    return jsonResponse(result);
  } catch (error) {
    return uploadCreateErrorResponse(error);
  }
}

export async function postUploadCompleteRoute(request: Request) {
  const auth = await requireWriteAuth(request);
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

  if (!uploadKeyBelongsToUser(key, userId)) {
    return forbidden();
  }

  try {
    const result = await completeUploadSession(userId, {
      contentType: parsedBody.contentType,
      filename,
      key,
    });
    return jsonResponse(result);
  } catch (error) {
    return uploadCompleteErrorResponse(error, key);
  }
}
