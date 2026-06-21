import type { AppLocale } from "@/i18n/config";
import { jsonResponse, notFound } from "@/lib/api/helpers";
import { PUBLIC_LOCALE_CATALOG_HEADERS } from "@/lib/public-cache-control";

export async function getSectionDetailAction(
  parsedJwId: number,
  locale: AppLocale,
) {
  const { findSectionDetailByJwId } = await import(
    "@/features/catalog/server/course-section-queries"
  );
  const section = await findSectionDetailByJwId(parsedJwId, locale);

  if (!section) {
    return notFound("Section not found");
  }

  return jsonResponse(section, {
    headers: PUBLIC_LOCALE_CATALOG_HEADERS,
  });
}
