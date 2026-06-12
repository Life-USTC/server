import { sanitizeFilename } from "@/features/uploads/lib/upload-utils";
import {
  badRequest,
  handleRouteError,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import {
  deleteUploadAction,
  listUploadsAction,
  renameUploadAction,
} from "@/lib/api/routes/upload-management-actions";
import { parseUploadId } from "@/lib/api/routes/upload-route-helpers";
import { uploadRenameRequestSchema } from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/api-auth";

type IdParams = { id: string };

export async function getUploadsRoute(request: Request) {
  return withUploadAuth(request, "Failed to list uploads", (userId) =>
    listUploadsAction(userId),
  );
}

export async function patchUploadRoute(request: Request, params: IdParams) {
  const parsed = parseUploadId(params);
  if (parsed instanceof Response) {
    return parsed;
  }
  const parsedBody = await parseRouteJsonBody(
    request,
    uploadRenameRequestSchema,
    "Invalid update payload",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  const filename = sanitizeFilename(parsedBody.filename);
  if (!filename) {
    return badRequest("Filename required");
  }

  return withUploadAuth(request, "Failed to rename upload", (userId) =>
    renameUploadAction({
      filename,
      id: parsed.id,
      userId,
    }),
  );
}

export async function deleteUploadRoute(request: Request, params: IdParams) {
  const parsed = parseUploadId(params);
  if (parsed instanceof Response) {
    return parsed;
  }

  return withUploadAuth(request, "Failed to delete upload", (userId) =>
    deleteUploadAction({
      id: parsed.id,
      request,
      userId,
    }),
  );
}

async function withUploadAuth(
  request: Request,
  errorMessage: string,
  action: (userId: string) => Promise<Response>,
) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    return await action(auth.userId);
  } catch (error) {
    return handleRouteError(errorMessage, error);
  }
}
