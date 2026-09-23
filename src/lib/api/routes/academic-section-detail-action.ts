import type { AppLocale } from "@/i18n/config";
import { notFound } from "@/lib/api/helpers";
import { schemaJsonResponse } from "@/lib/api/responses";
import { sectionDetailSchema } from "@/lib/api/schemas/response-schemas";

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

  return schemaJsonResponse(sectionDetailSchema, section, {
    headers: cacheHeaders,
  });
}
