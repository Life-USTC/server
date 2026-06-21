import { findSectionSummaryByJwId } from "@/features/catalog/server/course-section-queries";
import type { Locale } from "./helper-schemas";

export async function resolveSectionByJwId(jwId: number, locale: Locale) {
  return { section: await findSectionSummaryByJwId(jwId, locale) };
}
