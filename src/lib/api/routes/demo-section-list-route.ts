import {
  CATALOG_ID_LIST_MAX_ITEMS,
  CATALOG_MAX_ID,
} from "@/features/catalog/lib/catalog-list-query";
import { getDemoSectionList } from "@/features/demo/server/demo-section-list";
import { getDemoSubscribedSections } from "@/features/demo/server/demo-subscriptions";
import type { AppLocale } from "@/i18n/config";
import { badRequest, notFound, parseRouteQuery } from "@/lib/api/helpers";
import { schemaJsonResponse } from "@/lib/api/responses";
import { sectionsQuerySchema } from "@/lib/api/schemas/request-schemas";
import { paginatedSectionResponseSchema } from "@/lib/api/schemas/response-schemas";

export function getDemoSectionListRoute(request: Request, locale: AppLocale) {
  const params = new URL(request.url).searchParams;
  if (new Set(params.keys()).size !== params.size)
    return badRequest("Duplicate section query parameters");
  const parsed = parseRouteQuery(
    params,
    sectionsQuerySchema.strict(),
    "Invalid section query",
  );
  if (parsed instanceof Response) return parsed;
  const samples = getDemoSubscribedSections(locale);
  for (const [key, field] of [
    ["ids", "id"],
    ["jwIds", "jwId"],
  ] as const) {
    const value = parsed.query[key];
    if (value === undefined) continue;
    const ids = value.split(",").map((id) => id.trim());
    if (
      ids.length > CATALOG_ID_LIST_MAX_ITEMS ||
      ids.some(
        (id) =>
          !/^\d+$/.test(id) || Number(id) < 1 || Number(id) > CATALOG_MAX_ID,
      )
    )
      return badRequest("Invalid section identifiers");
    if (
      ids.some(
        (id) => !samples.some((section) => section[field] === Number(id)),
      )
    )
      return notFound("Demo section not found");
  }
  return schemaJsonResponse(
    paginatedSectionResponseSchema,
    getDemoSectionList(
      params.has("locale") ? parsed.query.locale : locale,
      parsed.query,
      parsed.pagination,
    ),
  );
}
