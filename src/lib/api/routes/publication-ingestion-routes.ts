import {
  ingestPublicationBatch,
  PublicationIngestionBadRequestError,
  PublicationIngestionConflictError,
  PublicationIngestionForbiddenError,
} from "@/features/publications/server/publication-ingestion-service";
import {
  completePublicationObject,
  PublicationObjectBadRequestError,
  PublicationObjectNotFoundError,
  PublicationObjectStorageUnavailableError,
  planPublicationObjects,
} from "@/features/publications/server/publication-object-service";
import {
  badRequest,
  errorResponse,
  forbidden,
  handleRouteError,
  notFound,
  parseRouteJsonBody,
  schemaJsonResponse,
} from "@/lib/api/helpers";
import {
  publicationIngestionBatchRequestSchema,
  publicationObjectCompleteRequestSchema,
  publicationObjectPlanRequestSchema,
} from "@/lib/api/schemas/request-schemas";
import {
  publicationIngestionBatchResponseSchema,
  publicationObjectCompleteResponseSchema,
  publicationObjectPlanResponseSchema,
} from "@/lib/api/schemas/response-schemas";
import { requireAuthPrincipal } from "@/lib/auth/api-auth";

const INGESTION_SCOPE = {
  bearerScope: { feature: "publication.ingest", action: "write" as const },
} as const;

function mapIngestionError(error: unknown) {
  if (error instanceof PublicationIngestionBadRequestError) {
    return badRequest(error.message);
  }
  if (error instanceof PublicationIngestionForbiddenError) {
    return forbidden();
  }
  if (error instanceof PublicationIngestionConflictError) {
    return errorResponse(error.message, 409);
  }
  return handleRouteError("Failed to ingest publication batch", error);
}

function mapObjectError(error: unknown) {
  if (error instanceof PublicationObjectBadRequestError) {
    return badRequest(error.message);
  }
  if (error instanceof PublicationObjectNotFoundError) {
    return notFound(error.message);
  }
  if (error instanceof PublicationObjectStorageUnavailableError) {
    return errorResponse(error.message, 503);
  }
  if (error instanceof PublicationIngestionForbiddenError) {
    return forbidden();
  }
  return handleRouteError("Failed to process publication object", error);
}

export async function postPublicationIngestionBatchRoute(request: Request) {
  const auth = await requireAuthPrincipal(request, {
    ...INGESTION_SCOPE,
    rateLimit: { action: "publication:ingest:write", tier: "batch" },
  });
  if (auth instanceof Response) return auth;

  const parsedBody = await parseRouteJsonBody(
    request,
    publicationIngestionBatchRequestSchema,
    "Invalid publication ingestion batch",
  );
  if (parsedBody instanceof Response) return parsedBody;

  try {
    const result = await ingestPublicationBatch({
      payload: parsedBody,
      principal: auth,
    });
    return schemaJsonResponse(publicationIngestionBatchResponseSchema, result);
  } catch (error) {
    return mapIngestionError(error);
  }
}

export async function postPublicationObjectPlanRoute(request: Request) {
  const auth = await requireAuthPrincipal(request, {
    ...INGESTION_SCOPE,
    rateLimit: { action: "publication:ingest:write", tier: "batch" },
  });
  if (auth instanceof Response) return auth;

  const parsedBody = await parseRouteJsonBody(
    request,
    publicationObjectPlanRequestSchema,
    "Invalid publication object plan",
  );
  if (parsedBody instanceof Response) return parsedBody;

  try {
    const result = await planPublicationObjects({
      payload: parsedBody,
      principal: auth,
    });
    return schemaJsonResponse(publicationObjectPlanResponseSchema, result);
  } catch (error) {
    return mapObjectError(error);
  }
}

export async function postPublicationObjectCompleteRoute(request: Request) {
  const auth = await requireAuthPrincipal(request, {
    ...INGESTION_SCOPE,
    rateLimit: { action: "publication:ingest:write", tier: "batch" },
  });
  if (auth instanceof Response) return auth;

  const parsedBody = await parseRouteJsonBody(
    request,
    publicationObjectCompleteRequestSchema,
    "Invalid publication object completion",
  );
  if (parsedBody instanceof Response) return parsedBody;

  try {
    const result = await completePublicationObject({
      payload: parsedBody,
      principal: auth,
    });
    return schemaJsonResponse(publicationObjectCompleteResponseSchema, result);
  } catch (error) {
    return mapObjectError(error);
  }
}
