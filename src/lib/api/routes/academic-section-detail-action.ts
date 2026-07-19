import type { AppLocale } from "@/i18n/config";
import { jsonResponse, notFound } from "@/lib/api/helpers";

export async function getSectionDetailAction(
  parsedJwId: number,
  locale: AppLocale,
  cacheHeaders: HeadersInit,
) {
  const { findSectionDetailByJwId } = await import(
    "@/features/catalog/server/course-section-queries"
  );
  const section = await findSectionDetailByJwId(parsedJwId, locale);

  if (!section) {
    return notFound("Section not found");
  }

  return jsonResponse(section, {
    headers: cacheHeaders,
  });
}
