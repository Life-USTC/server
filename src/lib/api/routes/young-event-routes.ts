import {
  getYoungEventImageResponse,
  YoungEventImageOriginError,
  YoungEventImageStorageUnavailableError,
} from "@/features/young/server/young-event-image-service";
import {
  getYoungEvent,
  listYoungEvents,
} from "@/features/young/server/young-event-service";
import {
  handleRouteError,
  notFound,
  parseRouteParams,
  parseRouteQuery,
  schemaJsonResponse,
} from "@/lib/api/helpers";
import { youngEventYoungIdPathParamsSchema } from "@/lib/api/schemas/request-path-schemas";
import {
  paginatedYoungEventResponseSchema,
  youngEventDetailSchema,
  youngEventsQuerySchema,
} from "@/lib/api/schemas/young-event-schemas";
import { PUBLIC_CATALOG_HEADERS } from "@/lib/public-cache-control";

export async function getYoungEventsRoute(request: Request) {
  const parsed = parseRouteQuery(
    new URL(request.url).searchParams,
    youngEventsQuerySchema,
    "Invalid young events query",
    { logErrors: true },
  );
  if (parsed instanceof Response) return parsed;

  const { query, pagination } = parsed;
  try {
    const result = await listYoungEvents({
      active: query.active,
      category: query.category,
      search: query.search,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
    return schemaJsonResponse(paginatedYoungEventResponseSchema, result, {
      headers: PUBLIC_CATALOG_HEADERS,
    });
  } catch (error) {
    return handleRouteError("Failed to fetch young events", error);
  }
}

export async function getYoungEventDetailRoute(
  _request: Request,
  params: { youngId: string },
) {
  try {
    const event = await getYoungEvent(params.youngId);
    if (event == null) {
      return notFound("Young event not found");
    }
    return schemaJsonResponse(youngEventDetailSchema, event, {
      headers: PUBLIC_CATALOG_HEADERS,
    });
  } catch (error) {
    return handleRouteError("Failed to fetch young event", error);
  }
}

export async function getYoungEventImageRoute(
  request: Request,
  params: { youngId: string },
  options: { defer?: (promise: Promise<unknown>) => void } = {},
) {
  const parsed = await parseRouteParams(
    Promise.resolve(params),
    youngEventYoungIdPathParamsSchema,
    "Invalid young event ID",
  );
  if (parsed instanceof Response) return parsed;

  try {
    const result = await getYoungEventImageResponse({
      request,
      youngId: parsed.youngId,
      defer: options.defer,
    });
    if (!result) return notFound("Young event image not found");
    return result;
  } catch (error) {
    if (error instanceof YoungEventImageStorageUnavailableError) {
      const response = handleRouteError(
        "Young event image storage unavailable",
        error,
        503,
      );
      response.headers.set("Retry-After", "60");
      return response;
    }
    if (error instanceof YoungEventImageOriginError) {
      return handleRouteError(
        "Failed to fetch young event image from origin",
        error,
        502,
      );
    }
    return handleRouteError("Failed to fetch young event image", error);
  }
}
