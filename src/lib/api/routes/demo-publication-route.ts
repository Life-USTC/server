import {
  type DemoNewsBinary,
  getDemoNewsDetail,
  getDemoNewsImage,
  getDemoNewsList,
  getDemoNewsObject,
  getDemoNewsSources,
} from "@/features/demo/server/demo-news";
import { parseDemoNewsQuery } from "@/features/demo/server/demo-news-query";
import type { AppLocale } from "@/i18n/config";
import { parseRouteParams } from "@/lib/api/helpers";
import { errorResponse, schemaJsonResponse } from "@/lib/api/responses";
import {
  publicationIdPathParamsSchema,
  publicationImagePathParamsSchema,
  publicationObjectPathParamsSchema,
} from "@/lib/api/schemas/request-schemas";
import {
  publicPublicationDetailSchema,
  publicPublicationSourceDirectoryResponseSchema,
  publicPublicationsResponseSchema,
} from "@/lib/api/schemas/response-schemas";

function noQuery(request: Request) {
  return new URL(request.url).searchParams.size
    ? errorResponse("Unexpected demo publication query", 400)
    : null;
}
export function getDemoPublicationsRoute(request: Request, locale: AppLocale) {
  const parsed = parseDemoNewsQuery(new URL(request.url));
  if (!parsed.success)
    return errorResponse("Invalid demo publication query", 400);
  const result = getDemoNewsList(locale, parsed.data);
  return result
    ? schemaJsonResponse(publicPublicationsResponseSchema, result)
    : errorResponse("Demo publication target not found", 404);
}
export function getDemoPublicationSourcesRoute(
  request: Request,
  locale: AppLocale,
) {
  return (
    noQuery(request) ??
    schemaJsonResponse(
      publicPublicationSourceDirectoryResponseSchema,
      getDemoNewsSources(locale),
    )
  );
}
export async function getDemoPublicationDetailRoute(
  request: Request,
  locale: AppLocale,
  id: string,
) {
  const invalid = noQuery(request);
  if (invalid) return invalid;
  const parsed = await parseRouteParams(
    Promise.resolve({ id }),
    publicationIdPathParamsSchema,
    "Invalid publication ID",
  );
  if (parsed instanceof Response) return parsed;
  const result = getDemoNewsDetail(locale, parsed.id);
  return result
    ? schemaJsonResponse(publicPublicationDetailSchema, result)
    : errorResponse("Demo publication not found", 404);
}
function binaryResponse(request: Request, item: DemoNewsBinary) {
  const etag = `"${item.sha256}"`;
  const headers = new Headers({
    "Content-Type": item.contentType,
    "Content-Length": String(item.bytes.byteLength),
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  });
  const extension =
    item.contentType === "text/plain"
      ? ".txt"
      : item.contentType === "image/png"
        ? ".png"
        : "";
  headers.set(
    "Content-Disposition",
    item.kind === "media"
      ? "inline"
      : `attachment; filename="publication-${item.kind}-${item.sha256.slice(0, 16)}${extension}"`,
  );
  if (
    request.headers
      .get("If-None-Match")
      ?.split(",")
      .some((candidate) => {
        const normalized = candidate.trim().replace(/^W\//, "");
        return normalized === "*" || normalized === etag;
      })
  )
    return new Response(null, { status: 304, headers });
  return new Response(
    request.method === "HEAD" ? null : item.bytes.slice().buffer,
    { headers },
  );
}
export async function getDemoPublicationObjectRoute(
  request: Request,
  kind: string,
  sha256: string,
) {
  const invalid = noQuery(request);
  if (invalid) return invalid;
  const parsed = await parseRouteParams(
    Promise.resolve({ kind, sha256 }),
    publicationObjectPathParamsSchema,
    "Invalid publication object path",
  );
  if (parsed instanceof Response) return parsed;
  const item = getDemoNewsObject(parsed.kind, parsed.sha256);
  return item
    ? binaryResponse(request, item)
    : errorResponse("Demo publication object not found", 404);
}
export async function getDemoPublicationImageRoute(
  request: Request,
  hash: string,
) {
  const invalid = noQuery(request);
  if (invalid) return invalid;
  const parsed = await parseRouteParams(
    Promise.resolve({ hash }),
    publicationImagePathParamsSchema,
    "Invalid publication image hash",
  );
  if (parsed instanceof Response) return parsed;
  const item = getDemoNewsImage(parsed.hash);
  return item
    ? binaryResponse(request, item)
    : errorResponse("Demo publication image not found", 404);
}
