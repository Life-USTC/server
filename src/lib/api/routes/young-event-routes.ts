import {
  getYoungEventImageByPathResponse,
  getYoungEventPosterUrl,
  YoungEventImageOriginError,
  YoungEventImageStorageUnavailableError,
} from "@/features/young/server/young-event-image-service";
import {
  getYoungEvent,
  getYoungOrganizer,
  listYoungEvents,
  listYoungOrganizers,
} from "@/features/young/server/young-event-service";
import {
  badRequest,
  handleRouteError,
  notFound,
  parseRouteParams,
  parseRouteQuery,
  schemaJsonResponse,
} from "@/lib/api/helpers";
import {
  youngEventYoungIdPathParamsSchema,
  youngOrganizerIdPathParamsSchema,
} from "@/lib/api/schemas/request-path-schemas";
import {
  paginatedYoungEventResponseSchema,
  paginatedYoungOrganizerResponseSchema,
  youngEventDetailSchema,
  youngEventsQuerySchema,
  youngOrganizerSummarySchema,
  youngOrganizersQuerySchema,
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
      module: query.module,
      activityLevel: query.activityLevel,
      search: query.search,
      organizerId: query.organizerId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      timeBasis: query.timeBasis,
      dateUnknown: query.dateUnknown,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
    const { unknownDateCount, source, ...page } = result;
    return schemaJsonResponse(
      paginatedYoungEventResponseSchema,
      {
        ...page,
        meta: { unknownDateCount, source },
      },
      { headers: PUBLIC_CATALOG_HEADERS },
    );
  } catch (error) {
    if (error instanceof RangeError) return badRequest(error.message);
    return handleRouteError("Failed to fetch young events", error);
  }
}

export async function getYoungOrganizersRoute(request: Request) {
  const parsed = parseRouteQuery(
    new URL(request.url).searchParams,
    youngOrganizersQuerySchema,
    "Invalid young organizers query",
    { logErrors: true },
  );
  if (parsed instanceof Response) return parsed;

  try {
    const result = await listYoungOrganizers({
      search: parsed.query.search,
      page: parsed.pagination.page,
      pageSize: parsed.pagination.pageSize,
    });
    return schemaJsonResponse(paginatedYoungOrganizerResponseSchema, result, {
      headers: PUBLIC_CATALOG_HEADERS,
    });
  } catch (error) {
    return handleRouteError("Failed to fetch young organizers", error);
  }
}

export async function getYoungOrganizerDetailRoute(
  _request: Request,
  params: { organizerId: string },
) {
  const parsed = await parseRouteParams(
    Promise.resolve(params),
    youngOrganizerIdPathParamsSchema,
    "Invalid young organizer ID",
  );
  if (parsed instanceof Response) return parsed;

  try {
    const organizer = await getYoungOrganizer(parsed.organizerId);
    if (organizer == null) return notFound("Young organizer not found");
    return schemaJsonResponse(youngOrganizerSummarySchema, organizer, {
      headers: PUBLIC_CATALOG_HEADERS,
    });
  } catch (error) {
    return handleRouteError("Failed to fetch young organizer", error);
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

/** Serve immutable image representations through the local R2-backed proxy. */
export async function getYoungEventImageByPathRoute(
  request: Request,
  params: { path: string },
  options: { defer?: (promise: Promise<unknown>) => void } = {},
) {
  try {
    const result = await getYoungEventImageByPathResponse({
      request,
      imagePath: params.path,
      defer: options.defer,
    });
    if (!result) {
      const response = notFound("Young event image not found");
      response.headers.set("Cache-Control", "public, max-age=300");
      return response;
    }
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
      const response = handleRouteError(
        "Failed to fetch young event image from origin",
        error,
        502,
      );
      response.headers.set("Cache-Control", "public, max-age=60");
      return response;
    }
    return handleRouteError("Failed to fetch young event image", error);
  }
}

export async function getYoungEventImageRoute(
  _request: Request,
  params: { youngId: string },
) {
  const parsed = await parseRouteParams(
    Promise.resolve(params),
    youngEventYoungIdPathParamsSchema,
    "Invalid young event ID",
  );
  if (parsed instanceof Response) return parsed;
  try {
    const imageUrl = await getYoungEventPosterUrl(parsed.youngId);
    const response = imageUrl
      ? new Response(null, { status: 302, headers: { Location: imageUrl } })
      : notFound("Young event image not found");
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Cloudflare-CDN-Cache-Control", "no-store");
    return response;
  } catch (error) {
    return handleRouteError("Failed to resolve young event image", error);
  }
}
