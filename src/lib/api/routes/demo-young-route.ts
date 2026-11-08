import {
  getDemoYoungEvent,
  getDemoYoungEvents,
  getDemoYoungOrganizer,
  getDemoYoungOrganizers,
} from "@/features/demo/server/demo-young";
import {
  DEMO_YOUNG_POSTER_PATH,
  getDemoYoungPoster,
} from "@/features/demo/server/demo-young-assets";
import type { AppLocale } from "@/i18n/config";
import { parseRouteParams, parseRouteQuery } from "@/lib/api/helpers";
import { errorResponse, schemaJsonResponse } from "@/lib/api/responses";
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

const noQuery = (request: Request) =>
  new URL(request.url).searchParams.size
    ? errorResponse("Unexpected demo Young query", 400)
    : null;
export function getDemoYoungEventsRoute(request: Request, locale: AppLocale) {
  const parsed = parseRouteQuery(
    new URL(request.url).searchParams,
    youngEventsQuerySchema,
    "Invalid young events query",
  );
  if (parsed instanceof Response) return parsed;
  try {
    const { unknownDateCount, source, ...page } = getDemoYoungEvents(locale, {
      ...parsed.query,
      ...parsed.pagination,
    });
    return schemaJsonResponse(paginatedYoungEventResponseSchema, {
      ...page,
      meta: { unknownDateCount, source },
    });
  } catch (error) {
    if (error instanceof RangeError) return errorResponse(error.message, 400);
    throw error;
  }
}
export function getDemoYoungOrganizersRoute(
  request: Request,
  locale: AppLocale,
) {
  const parsed = parseRouteQuery(
    new URL(request.url).searchParams,
    youngOrganizersQuerySchema,
    "Invalid young organizers query",
  );
  return parsed instanceof Response
    ? parsed
    : schemaJsonResponse(
        paginatedYoungOrganizerResponseSchema,
        getDemoYoungOrganizers(locale, {
          ...parsed.query,
          ...parsed.pagination,
        }),
      );
}
export async function getDemoYoungEventRoute(
  request: Request,
  locale: AppLocale,
  id: string,
) {
  const invalid = noQuery(request);
  if (invalid) return invalid;
  const parsed = await parseRouteParams(
    Promise.resolve({ youngId: id }),
    youngEventYoungIdPathParamsSchema,
    "Invalid young event ID",
  );
  if (parsed instanceof Response) return parsed;
  const event = getDemoYoungEvent(locale, parsed.youngId);
  return event
    ? schemaJsonResponse(youngEventDetailSchema, event)
    : errorResponse("Demo Young event not found", 404);
}
export async function getDemoYoungOrganizerRoute(
  request: Request,
  locale: AppLocale,
  id: string,
) {
  const invalid = noQuery(request);
  if (invalid) return invalid;
  const parsed = await parseRouteParams(
    Promise.resolve({ organizerId: id }),
    youngOrganizerIdPathParamsSchema,
    "Invalid young organizer ID",
  );
  if (parsed instanceof Response) return parsed;
  const organizer = getDemoYoungOrganizer(locale, parsed.organizerId);
  return organizer
    ? schemaJsonResponse(youngOrganizerSummarySchema, organizer)
    : errorResponse("Demo Young organizer not found", 404);
}
export function getDemoYoungPosterRedirect(
  request: Request,
  locale: AppLocale,
  id: string,
) {
  const invalid = noQuery(request);
  if (invalid) return invalid;
  return getDemoYoungEvent(locale, id)
    ? new Response(null, {
        status: 302,
        headers: {
          Location: `/api/catalog/young-events/images/${DEMO_YOUNG_POSTER_PATH}`,
        },
      })
    : errorResponse("Demo Young event not found", 404);
}
export function getDemoYoungPosterRoute(request: Request, path: string) {
  const invalid = noQuery(request);
  if (invalid) return invalid;
  const poster = getDemoYoungPoster(path);
  if (!poster) return errorResponse("Demo Young poster not found", 404);
  const headers = new Headers({
    "Content-Type": poster.contentType,
    "Content-Length": String(poster.bytes.byteLength),
    "X-Content-Type-Options": "nosniff",
    ETag: `"${poster.sha256}"`,
  });
  if (
    request.headers
      .get("If-None-Match")
      ?.split(",")
      .some((value) =>
        ["*", `"${poster.sha256}"`].includes(value.trim().replace(/^W\//, "")),
      )
  )
    return new Response(null, { status: 304, headers });
  return new Response(
    request.method === "HEAD" ? null : poster.bytes.slice().buffer,
    { headers },
  );
}
