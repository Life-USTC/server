import { sanitizeFilename } from "@/features/uploads/lib/upload-utils";
import {
  deleteOwnedUpload,
  listUploads,
  renameOwnedUpload,
} from "@/features/uploads/server/upload-service";
import {
  badRequest,
  buildPaginatedResponse,
  errorResponse,
  forbidden,
  getRequestSearchParams,
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteJsonBody,
  parseRouteQuery,
  suspensionForbidden,
} from "@/lib/api/helpers";
import { parseUploadId } from "@/lib/api/routes/upload-route-helpers";
import {
  uploadRenameRequestSchema,
  uploadsQuerySchema,
} from "@/lib/api/schemas/request-schemas";
import { attributionFromApiPrincipal } from "@/lib/audit/principal-attribution";
import { getAuditRequestMetadata } from "@/lib/audit/write-audit-log";
import {
  type ApiPrincipal,
  requireAuthPrincipal,
  requireWriteAuth,
  requireWriteAuthPrincipal,
} from "@/lib/auth/api-auth";

type IdParams = { id: string };

type OwnedUploadMutationFailure = {
  error: "forbidden" | "not_found" | "storage_delete_failed" | "suspended";
  reason?: string | null;
};

function mapOwnedUploadMutationFailure(result: OwnedUploadMutationFailure) {
  if (result.error === "suspended") {
    return suspensionForbidden("reason" in result ? result.reason : null);
  }
  if (result.error === "forbidden") return forbidden();
  if (result.error === "storage_delete_failed") {
    return errorResponse("Failed to delete upload object", 502);
  }
  return notFound();
}

export async function getUploadsRoute(request: Request) {
  return withUploadAuth(
    request,
    "Failed to list uploads",
    async (principal) => {
      const parsed = parseRouteQuery(
        getRequestSearchParams(request),
        uploadsQuerySchema,
        "Invalid uploads query",
        { pagination: { defaultPageSize: 20, maxPageSize: 100 } },
      );
      if (parsed instanceof Response) return parsed;

      const result = await listUploads(principal.userId, parsed.pagination);
      return jsonResponse({
        ...buildPaginatedResponse(
          result.uploads,
          parsed.pagination.page,
          parsed.pagination.pageSize,
          result.total,
        ),
        meta: {
          maxFileSizeBytes: result.maxFileSizeBytes,
          quotaBytes: result.quotaBytes,
          usedBytes: result.usedBytes,
        },
      });
    },
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
    return result.ok
      ? jsonResponse({ upload: result.upload })
      : mapOwnedUploadMutationFailure(result);
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
    async (principal) => {
      const result = await deleteOwnedUpload({
        audit: {
          ...getAuditRequestMetadata(request),
          ...attributionFromApiPrincipal(principal),
        },
        id: parsed.id,
        userId: principal.userId,
      });
      if (!result.ok) {
        return mapOwnedUploadMutationFailure(result);
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
  action: (principal: ApiPrincipal) => Promise<Response>,
  options: { write?: boolean } = {},
) {
  const auth = options.write
    ? await requireWriteAuthPrincipal(request)
    : await requireAuthPrincipal(request, {
        bearerScope: { feature: "workspace.upload", action: "read" },
      });
  if (auth instanceof Response) return auth;

  try {
    return await action(auth);
  } catch (error) {
    return handleRouteError(errorMessage, error);
  }
}
