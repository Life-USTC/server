import {
  ingestPublicationBatch,
  PublicationIngestionBadRequestError,
  PublicationIngestionConflictError,
} from "@/features/publications/server/publication-ingestion-service";
import {
  PublicationObjectBadRequestError,
  PublicationObjectNotFoundError,
  PublicationObjectStorageUnavailableError,
  planPublicationObjects,
  uploadPublicationObject,
} from "@/features/publications/server/publication-object-service";
import {
  badRequest,
  errorResponse,
  handleRouteError,
  notFound,
  parseRouteJsonBody,
  schemaJsonResponse,
} from "@/lib/api/helpers";
import {
  publicationIngestionBatchRequestSchema,
  publicationObjectPlanRequestSchema,
  publicationObjectUploadParamsSchema,
} from "@/lib/api/schemas/request-schemas";
import {
  publicationIngestionBatchResponseSchema,
  publicationObjectPlanResponseSchema,
  publicationObjectUploadResponseSchema,
} from "@/lib/api/schemas/response-schemas";
import { requirePublicationIngestionPrincipal } from "@/lib/auth/publication-ingestion-auth";

function mapIngestionError(error: unknown) {
  if (error instanceof PublicationIngestionBadRequestError) {
    return badRequest(error.message);
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
  return handleRouteError("Failed to process publication object", error);
}

export async function postPublicationIngestionBatchRoute(request: Request) {
  const auth = await requirePublicationIngestionPrincipal(request);
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
  const auth = await requirePublicationIngestionPrincipal(request);
  if (auth instanceof Response) return auth;

  const parsedBody = await parseRouteJsonBody(
    request,
    publicationObjectPlanRequestSchema,
    "Invalid publication object plan",
  );
  if (parsedBody instanceof Response) return parsedBody;

  try {
    const result = await planPublicationObjects({
      origin: new URL(request.url).origin,
      payload: parsedBody,
      principal: auth,
    });
    return schemaJsonResponse(publicationObjectPlanResponseSchema, result);
  } catch (error) {
    return mapObjectError(error);
  }
}

export async function putPublicationObjectRoute(
  request: Request,
  params: { batchId?: string; kind?: string; sha256?: string },
) {
  const auth = await requirePublicationIngestionPrincipal(request);
  if (auth instanceof Response) return auth;

  const parsed = publicationObjectUploadParamsSchema.safeParse({
    batchId: params.batchId,
    kind: params.kind,
    sha256: params.sha256,
  });
  if (!parsed.success) return badRequest("Invalid publication object upload");
  if (!request.body) return badRequest("Missing publication object body");
  const contentLength = request.headers.get("content-length");
  if (!contentLength || !/^\d+$/.test(contentLength)) {
    return badRequest("Missing publication object content length");
  }

  try {
    const result = await uploadPublicationObject({
      body: request.body,
      payload: parsed.data,
      principal: auth,
      size: Number(contentLength),
    });
    return schemaJsonResponse(publicationObjectUploadResponseSchema, result);
  } catch (error) {
    return mapObjectError(error);
  }
}
