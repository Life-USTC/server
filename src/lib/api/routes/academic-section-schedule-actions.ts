import {
  getSectionScheduleGroupsByJwId,
  getSectionSchedulesByJwId,
} from "@/features/catalog/server/schedule-read-model";
import type { AppLocale } from "@/i18n/config";
import { notFound } from "@/lib/api/helpers";
import { schemaJsonResponse } from "@/lib/api/responses";
import {
  paginatedSectionSchedulesResponseSchema,
  scheduleGroupsResponseSchema,
  sectionSchedulesResponseSchema,
} from "@/lib/api/schemas/schedule-response-schema-core";

export async function getSectionSchedulesAction(
  parsedJwId: number,
  locale: AppLocale,
  cacheHeaders: HeadersInit,
  filters: {
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const result = await getSectionSchedulesByJwId({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    limit: filters.limit,
    locale,
    sectionJwId: parsedJwId,
    ...(filters.page !== undefined || filters.pageSize !== undefined
      ? {
          pagination: {
            page: filters.page ?? 1,
            pageSize: filters.pageSize ?? 20,
          },
        }
      : {}),
  });

  if (!result.found) {
    return notFound("Section not found");
  }

  if (result.pagination) {
    return schemaJsonResponse(
      paginatedSectionSchedulesResponseSchema,
      {
        data: result.schedules,
        pagination: result.pagination,
      },
      { headers: cacheHeaders },
    );
  }

  return schemaJsonResponse(sectionSchedulesResponseSchema, result.schedules, {
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

  return schemaJsonResponse(
    scheduleGroupsResponseSchema,
    result.scheduleGroups,
    {
      headers: cacheHeaders,
    },
  );
}
