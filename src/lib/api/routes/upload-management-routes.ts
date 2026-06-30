import { sanitizeFilename } from "@/features/uploads/lib/upload-utils";
import {
  deleteOwnedUpload,
  listUploads,
  renameOwnedUpload,
} from "@/features/uploads/server/upload-service";
import {
  badRequest,
  errorResponse,
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { parseUploadId } from "@/lib/api/routes/upload-route-helpers";
import { uploadRenameRequestSchema } from "@/lib/api/schemas/request-schemas";
import { getAuditRequestMetadata } from "@/lib/audit/write-audit-log";
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
    const result = await renameOwnedUpload({
      filename,
      id: parsed.id,
      userId: auth.userId,
    });
    return result.ok ? jsonResponse({ upload: result.upload }) : notFound();
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
      const result = await deleteOwnedUpload({
        audit: getAuditRequestMetadata(request),
        id: parsed.id,
        userId,
      });
      if (!result.ok) {
        if (result.error === "storage_delete_failed") {
          return errorResponse("Failed to delete upload object", 502);
        }
        return notFound();
      }

      return jsonResponse({
        deletedId: result.deletedId,
        deletedSize: result.deletedSize,
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
    : await requireAuth(request, {
        bearerScope: { feature: "upload", action: "read" },
      });
  if (auth instanceof Response) return auth;

  try {
    return await action(auth.userId);
  } catch (error) {
    return handleRouteError(errorMessage, error);
  }
}
