import { collapsePublicationListSearchParams } from "@/features/publications/lib/publication-read-request-schemas";
import {
  getPublicationImageResponse,
  PublicationImageOriginError,
  PublicationImageStorageUnavailableError,
} from "@/features/publications/server/publication-image-service";
import {
  getPublicPublicationById,
  getPublicPublicationObjectResponse,
  listPublications,
  PUBLICATION_READ_CACHE_HEADERS,
  PublicationReadStorageUnavailableError,
} from "@/features/publications/server/publication-public-read-service";
import { listPublicationSourceDirectory } from "@/features/publications/server/publication-source-directory-service";
import {
  handleRouteError,
  notFound,
  parseRouteParams,
  parseRouteQuery,
  schemaJsonResponse,
} from "@/lib/api/helpers";
import {
  publicationIdPathParamsSchema,
  publicationImagePathParamsSchema,
  publicationObjectPathParamsSchema,
  publicationsQuerySchema,
} from "@/lib/api/schemas/request-schemas";
import {
  publicPublicationDetailSchema,
  publicPublicationSourceDirectoryResponseSchema,
  publicPublicationsResponseSchema,
} from "@/lib/api/schemas/response-schemas";

const PUBLICATION_LIST_PAGINATION = {
  defaultPage: 1,
  defaultPageSize: 20,
  maxPageSize: 50,
};

export async function getPublicationsRoute(request: Request) {
  const parsed = parseRouteQuery(
    // The list page submits its source and level checkboxes as repeated
    // params; REST clients use the documented comma-separated form. Collapse
    // the former into the latter so one schema validates both (issue #1069).
    collapsePublicationListSearchParams(new URL(request.url).searchParams),
    publicationsQuerySchema,
    "Invalid publication query",
    { pagination: PUBLICATION_LIST_PAGINATION, logErrors: true },
  );
  if (parsed instanceof Response) return parsed;

  try {
    const result = await listPublications({
      filters: parsed.query,
      pagination: parsed.pagination,
    });
    return schemaJsonResponse(publicPublicationsResponseSchema, result, {
      headers: PUBLICATION_READ_CACHE_HEADERS,
    });
  } catch (error) {
    return handleRouteError("Failed to fetch publications", error);
  }
}

export async function getPublicationSourcesRoute(_request: Request) {
  try {
    const result = await listPublicationSourceDirectory();
    return schemaJsonResponse(
      publicPublicationSourceDirectoryResponseSchema,
      result,
      { headers: PUBLICATION_READ_CACHE_HEADERS },
    );
  } catch (error) {
    return handleRouteError("Failed to fetch publication sources", error);
  }
}

export async function getPublicPublicationRoute(
  _request: Request,
  params: { id: string },
) {
  const parsed = await parseRouteParams(
    Promise.resolve(params),
    publicationIdPathParamsSchema,
    "Invalid publication ID",
  );
  if (parsed instanceof Response) return parsed;

  try {
    const result = await getPublicPublicationById(parsed.id);
    if (!result) return notFound("Publication not found");
    return schemaJsonResponse(publicPublicationDetailSchema, result, {
      headers: PUBLICATION_READ_CACHE_HEADERS,
    });
  } catch (error) {
    if (error instanceof PublicationReadStorageUnavailableError) {
      const response = handleRouteError(
        "Publication body storage unavailable",
        error,
        503,
      );
      response.headers.set("Retry-After", "60");
      return response;
    }
    return handleRouteError("Failed to fetch publication", error);
  }
}

export async function getPublicPublicationObjectRoute(
  request: Request,
  params: { kind: string; sha256: string },
) {
  const parsed = await parseRouteParams(
    Promise.resolve(params),
    publicationObjectPathParamsSchema,
    "Invalid publication object path",
  );
  if (parsed instanceof Response) return parsed;

  try {
    const result = await getPublicPublicationObjectResponse({
      request,
      kind: parsed.kind,
      sha256: parsed.sha256,
    });
    if (!result) return notFound("Publication object not found");
    return result;
  } catch (error) {
    if (error instanceof PublicationReadStorageUnavailableError) {
      const response = handleRouteError(
        "Publication object storage unavailable",
        error,
        503,
      );
      response.headers.set("Retry-After", "60");
      return response;
    }
    return handleRouteError("Failed to fetch publication object", error);
  }
}

export async function getPublicPublicationImageRoute(
  request: Request,
  params: { hash: string },
  options: { defer?: (promise: Promise<unknown>) => void } = {},
) {
  const parsed = await parseRouteParams(
    Promise.resolve(params),
    publicationImagePathParamsSchema,
    "Invalid publication image hash",
  );
  if (parsed instanceof Response) return parsed;

  try {
    const result = await getPublicationImageResponse({
      request,
      hash: parsed.hash,
      defer: options.defer,
    });
    if (!result) return notFound("Publication image not found");
    return result;
  } catch (error) {
    if (error instanceof PublicationImageStorageUnavailableError) {
      const response = handleRouteError(
        "Publication image storage unavailable",
        error,
        503,
      );
      response.headers.set("Retry-After", "60");
      return response;
    }
    if (error instanceof PublicationImageOriginError) {
      const response = handleRouteError(
        "Failed to fetch publication image from origin",
        error,
        502,
      );
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
    return handleRouteError("Failed to fetch publication image", error);
  }
}
