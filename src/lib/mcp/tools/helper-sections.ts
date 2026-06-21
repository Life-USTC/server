import { findSectionToolSummaryByJwId } from "@/features/catalog/server/course-section-queries";
import type { Locale } from "./helper-schemas";

export async function resolveSectionByJwId(jwId: number, locale: Locale) {
  return { section: await findSectionToolSummaryByJwId(jwId, locale) };
}
