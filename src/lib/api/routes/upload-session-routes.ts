import { badRequest, forbidden, parseRouteJsonBody } from "@/lib/api/helpers";
import {
  uploadCompleteErrorResponse,
  uploadCreateErrorResponse,
} from "@/lib/api/routes/upload-route-errors";
import {
  completeUploadSessionAction,
  createUploadSessionAction,
} from "@/lib/api/routes/upload-session-actions";
import {
  parseUploadCreateInput,
  uploadKeyBelongsToUser,
} from "@/lib/api/routes/upload-session-helpers";
import {
  uploadCompleteRequestSchema,
  uploadCreateRequestSchema,
} from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/api-auth";

export async function postUploadRoute(request: Request) {
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

  const uploadInput = parseUploadCreateInput(parsedBody);
  if (uploadInput instanceof Response) return uploadInput;

  try {
    return await createUploadSessionAction(userId, uploadInput);
  } catch (error) {
    return uploadCreateErrorResponse(error);
  }
}

export async function postUploadCompleteRoute(request: Request) {
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

  if (!uploadKeyBelongsToUser(key, userId)) {
    return forbidden();
  }

  try {
    return await completeUploadSessionAction(userId, {
      contentType: parsedBody.contentType,
      filename,
      key,
    });
  } catch (error) {
    return uploadCompleteErrorResponse(error, key);
  }
}
