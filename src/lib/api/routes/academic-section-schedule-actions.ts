import {
  getSectionScheduleGroupsByJwId,
  getSectionSchedulesByJwId,
} from "@/features/catalog/server/schedule-read-model";
import type { AppLocale } from "@/i18n/config";
import { jsonResponse, notFound } from "@/lib/api/helpers";
import { PUBLIC_LOCALE_CATALOG_HEADERS } from "@/lib/public-cache-control";

export async function getSectionSchedulesAction(
  parsedJwId: number,
  locale: AppLocale,
) {
  const result = await getSectionSchedulesByJwId({
    locale,
    sectionJwId: parsedJwId,
  });

  if (!result.found) {
    return notFound("Section not found");
  }

  return jsonResponse(result.schedules, {
    headers: PUBLIC_LOCALE_CATALOG_HEADERS,
  });
}

export async function getSectionScheduleGroupsAction(
  parsedJwId: number,
  locale: AppLocale,
) {
  const result = await getSectionScheduleGroupsByJwId({
    locale,
    sectionJwId: parsedJwId,
  });

  if (!result.found) {
    return notFound("Section not found");
  }

  return jsonResponse(result.scheduleGroups, {
    headers: PUBLIC_LOCALE_CATALOG_HEADERS,
  });
}
