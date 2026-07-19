import {
  getSectionScheduleGroupsByJwId,
  getSectionSchedulesByJwId,
} from "@/features/catalog/server/schedule-read-model";
import type { AppLocale } from "@/i18n/config";
import { jsonResponse, notFound } from "@/lib/api/helpers";

export async function getSectionSchedulesAction(
  parsedJwId: number,
  locale: AppLocale,
  cacheHeaders: HeadersInit,
  filters: { dateFrom?: Date; dateTo?: Date; limit?: number } = {},
) {
  const result = await getSectionSchedulesByJwId({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    limit: filters.limit,
    locale,
    sectionJwId: parsedJwId,
  });

  if (!result.found) {
    return notFound("Section not found");
  }

  return jsonResponse(result.schedules, {
    headers: cacheHeaders,
  });
}

export async function getSectionScheduleGroupsAction(
  parsedJwId: number,
  locale: AppLocale,
  cacheHeaders: HeadersInit,
) {
  const result = await getSectionScheduleGroupsByJwId({
    locale,
    sectionJwId: parsedJwId,
  });

  if (!result.found) {
    return notFound("Section not found");
  }

  return jsonResponse(result.scheduleGroups, {
    headers: cacheHeaders,
  });
}
