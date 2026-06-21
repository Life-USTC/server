import { sanitizeFilename } from "@/features/uploads/lib/upload-utils";
import {
  deleteUploadRecord,
  listUploads,
  renameUpload,
} from "@/features/uploads/server/upload-service";
import {
  badRequest,
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import {
  cleanupDeletedUploadObject,
  writeUploadDeleteAuditLog,
} from "@/lib/api/routes/upload-delete-cleanup";
import { parseUploadId } from "@/lib/api/routes/upload-route-helpers";
import { uploadRenameRequestSchema } from "@/lib/api/schemas/request-schemas";
import { requireAuth, requireWriteAuth } from "@/lib/auth/api-auth";

type IdParams = { id: string };

export async function getUploadsRoute(request: Request) {
  return withUploadAuth(request, "Failed to list uploads", (userId) =>
    listUploads(userId).then(jsonResponse),
  );
}

export async function patchUploadRoute(request: Request, params: IdParams) {
  const parsed = parseUploadId(params);
  if (parsed instanceof Response) {
    return parsed;
  }

  const auth = await requireWriteAuth(request);
  if (auth instanceof Response) return auth;

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

  try {
    const upload = await renameUpload({
      filename,
      id: parsed.id,
      userId: auth.userId,
    });
    return upload ? jsonResponse({ upload }) : notFound();
  } catch (error) {
    return handleRouteError("Failed to rename upload", error);
  }
}

export async function deleteUploadRoute(request: Request, params: IdParams) {
  const parsed = parseUploadId(params);
  if (parsed instanceof Response) {
    return parsed;
  }

  return withUploadAuth(
    request,
    "Failed to delete upload",
    async (userId) => {
      const upload = await deleteUploadRecord({ id: parsed.id, userId });
      if (!upload) return notFound();

      await cleanupDeletedUploadObject(upload);
      writeUploadDeleteAuditLog({ request, upload, userId });
      return jsonResponse({
        deletedId: upload.id,
        deletedSize: upload.size,
      });
    },
    { write: true },
  );
}

async function withUploadAuth(
  request: Request,
  errorMessage: string,
  action: (userId: string) => Promise<Response>,
  options: { write?: boolean } = {},
) {
  const auth = options.write
    ? await requireWriteAuth(request)
    : await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    return await action(auth.userId);
  } catch (error) {
    return handleRouteError(errorMessage, error);
  }
}
