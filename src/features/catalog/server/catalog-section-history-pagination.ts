import { error } from "@sveltejs/kit";
import { PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT } from "./academic-query-includes";

// Prisma's PostgreSQL adapter accepts offsets above signed 32-bit range. Keep
// page arithmetic within JavaScript's exact integer range before calling it.
export const MAX_SECTION_HISTORY_OFFSET = Number.MAX_SAFE_INTEGER;
export const MAX_SECTION_HISTORY_PAGE =
  Math.floor(MAX_SECTION_HISTORY_OFFSET / PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT) +
  1;

export function parseSectionHistoryPage(value: string | null): number {
  if (value === null) return 1;
  const page = Number(value);
  if (
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(page) ||
    page > MAX_SECTION_HISTORY_PAGE
  ) {
    error(
      400,
      `sectionsPage must be a decimal integer between 1 and ${MAX_SECTION_HISTORY_PAGE}.`,
    );
  }
  return page;
}
