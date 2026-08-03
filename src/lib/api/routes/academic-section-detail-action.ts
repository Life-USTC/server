import type { AppLocale } from "@/i18n/config";
import { jsonResponse, notFound } from "@/lib/api/helpers";

export type SectionDetailActionOptions = {
  includeExams?: boolean;
  includeSchedules?: boolean;
  includeTeacherDepartments?: boolean;
};

export async function getSectionDetailAction(
  parsedJwId: number,
  locale: AppLocale,
  cacheHeaders: HeadersInit,
  options: SectionDetailActionOptions = {},
) {
  const { findSectionDetailByJwId } = await import(
    "@/features/catalog/server/course-section-queries"
  );
  const section = await findSectionDetailByJwId(parsedJwId, locale, options);

  if (!section) {
    return notFound("Section not found");
  }

  return jsonResponse(section, {
    headers: cacheHeaders,
  });
}
