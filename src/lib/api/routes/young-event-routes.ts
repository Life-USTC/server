import {
  getYoungEventImageByPathResponse,
  getYoungEventImageResponse,
  requestMatchesEtag,
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
import { logAppEvent } from "@/lib/log/app-logger";
import {
  type CloudflareCache,
  getCloudflareNamedCache,
} from "@/lib/ports/runtime";
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
    return schemaJsonResponse(paginatedYoungEventResponseSchema, result, {
      headers: PUBLIC_CATALOG_HEADERS,
    });
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

const YOUNG_EVENT_IMAGE_COLO_CACHE_NAME = "life-ustc-young-event-image-v1";
const YOUNG_EVENT_IMAGE_COLO_CACHE_PATH =
  "/_life-ustc-internal-cache/young-event-image/v1";

type YoungEventImageColoCache = {
  cache: CloudflareCache;
  request: Request;
};

async function openYoungEventImageColoCache(
  request: Request,
  youngId: string,
): Promise<YoungEventImageColoCache | undefined> {
  const cache = await getCloudflareNamedCache(
    YOUNG_EVENT_IMAGE_COLO_CACHE_NAME,
  )?.catch(() => undefined);
  if (!cache) return undefined;
  const key = new URL(
    `${YOUNG_EVENT_IMAGE_COLO_CACHE_PATH}/${encodeURIComponent(youngId)}`,
    request.url,
  );
  return { cache, request: new Request(key, { method: "GET" }) };
}

/** The Cache API expires entries with the response's own Cache-Control TTL;
 * only responses carrying an explicit max-age are stored (304s and the 503
 * storage-unavailable response are not). */
function isYoungEventImageColoCacheable(response: Response) {
  if (response.status === 304) return false;
  const cacheControl = response.headers.get("Cache-Control") ?? "";
  return (
    /\bmax-age=\d+/.test(cacheControl) && !/\bno-store\b/.test(cacheControl)
  );
}

async function writeYoungEventImageColoCache(
  target: YoungEventImageColoCache,
  response: Response,
  defer?: (promise: Promise<unknown>) => void,
) {
  let write: Promise<void>;
  try {
    write = target.cache.put(target.request, response);
  } catch {
    return;
  }
  const logged = write.catch((error: unknown) => {
    logAppEvent(
      "error",
      "Failed to cache young event image response",
      { source: "young-event-image" },
      error,
    );
  });
  if (defer) {
    defer(logged);
  } else {
    await logged;
  }
}

/**
 * Serve a rich-text inline image by its upstream young.ustc.edu.cn pic path.
 * Unlike the per-event poster route these bytes are event-independent, so the
 * per-colo cache is skipped and R2 alone deduplicates them.
 */
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

  // Repeat image requests are served from the per-colo Cache API so they skip
  // the DB + R2 + origin chain entirely.
  const coloCache = await openYoungEventImageColoCache(request, parsed.youngId);
  if (coloCache) {
    const cached = await coloCache.cache
      .match(coloCache.request)
      .catch(() => undefined);
    if (cached) {
      const etag = cached.headers.get("ETag");
      if (etag && requestMatchesEtag(request, etag)) {
        const headers = new Headers(cached.headers);
        headers.delete("Content-Length");
        return new Response(null, { status: 304, headers });
      }
      return cached;
    }
  }

  let response: Response;
  try {
    const result = await getYoungEventImageResponse({
      request,
      youngId: parsed.youngId,
      defer: options.defer,
    });
    if (!result) {
      // Short CDN caching on errors absorbs repeat misses without pinning a
      // stale 404 if the event gains a poster later.
      response = notFound("Young event image not found");
      response.headers.set("Cache-Control", "public, max-age=300");
    } else {
      response = result;
    }
  } catch (error) {
    if (error instanceof YoungEventImageStorageUnavailableError) {
      response = handleRouteError(
        "Young event image storage unavailable",
        error,
        503,
      );
      response.headers.set("Retry-After", "60");
    } else if (error instanceof YoungEventImageOriginError) {
      response = handleRouteError(
        "Failed to fetch young event image from origin",
        error,
        502,
      );
      response.headers.set("Cache-Control", "public, max-age=60");
    } else {
      return handleRouteError("Failed to fetch young event image", error);
    }
  }

  if (coloCache && isYoungEventImageColoCacheable(response)) {
    await writeYoungEventImageColoCache(
      coloCache,
      response.clone(),
      options.defer,
    );
  }
  return response;
}
