import * as z from "zod";
import {
  CATALOG_MAX_PAGE,
  CATALOG_SEARCH_MAX_LENGTH,
  CATALOG_SEARCH_MIN_LENGTH,
} from "@/features/catalog/lib/catalog-list-query";
import { APP_LOCALES, DEFAULT_LOCALE } from "@/i18n/config";
import {
  booleanQuerySchema,
  dateQuerySchema,
  deprecatedPaginationLimitParam,
  integerQueryRangeSchema,
  integerQuerySchema,
  integerStringRangeSchema,
  integerStringSchema,
  paginationPageSizeParam,
} from "./request-schema-primitives";

const catalogPaginationPageSizeSchema = integerStringRangeSchema({
  minimum: 1,
  maximum: 100,
  message: "pageSize must be between 1 and 100",
});

const catalogPageSchema = integerStringRangeSchema({
  minimum: 1,
  maximum: CATALOG_MAX_PAGE,
  message: `page must be between 1 and ${CATALOG_MAX_PAGE}`,
});

const catalogSearchSchema = z
  .string()
  .trim()
  .min(CATALOG_SEARCH_MIN_LENGTH, {
    message: `search must contain at least ${CATALOG_SEARCH_MIN_LENGTH} characters`,
  })
  .max(CATALOG_SEARCH_MAX_LENGTH, {
    message: `search must not exceed ${CATALOG_SEARCH_MAX_LENGTH} characters`,
  });

const catalogIdSchema = integerStringSchema
  .transform((value) => String(Number(value)))
  .meta({ override: { type: "integer", format: "int64" } });

const weekdayQuerySchema = integerQueryRangeSchema({
  minimum: 1,
  maximum: 7,
  message: "Weekday must be between 1 and 7",
});

const sectionScheduleLimitSchema = integerQueryRangeSchema({
  minimum: 1,
  maximum: 200,
  message: "Limit must be between 1 and 200",
});

export const catalogLocaleQuerySchema = z.object({
  locale: z.enum(APP_LOCALES).default(DEFAULT_LOCALE),
});

export const sectionsQuerySchema = catalogLocaleQuerySchema.extend({
  courseId: catalogIdSchema.optional(),
  courseJwId: catalogIdSchema.optional(),
  semesterId: catalogIdSchema.optional(),
  semesterJwId: catalogIdSchema.optional(),
  campusId: catalogIdSchema.optional(),
  departmentId: catalogIdSchema.optional(),
  teacherId: catalogIdSchema.optional(),
  teacherCode: z.string().trim().min(1).optional(),
  search: catalogSearchSchema.optional(),
  ids: z.string().trim().optional(),
  jwIds: z.string().trim().optional(),
  page: catalogPageSchema.optional(),
  pageSize: paginationPageSizeParam(catalogPaginationPageSizeSchema),
  limit: deprecatedPaginationLimitParam(catalogPaginationPageSizeSchema),
});

export const schedulesQuerySchema = catalogLocaleQuerySchema.extend({
  sectionId: integerQuerySchema.optional(),
  sectionJwId: integerQuerySchema.optional(),
  sectionCode: z.string().trim().min(1).optional(),
  teacherId: integerQuerySchema.optional(),
  teacherCode: z.string().trim().min(1).optional(),
  roomId: integerQuerySchema.optional(),
  roomJwId: integerQuerySchema.optional(),
  weekday: weekdayQuerySchema.optional(),
  dateFrom: dateQuerySchema().optional(),
  dateTo: dateQuerySchema().optional(),
  page: catalogPageSchema.optional(),
  pageSize: paginationPageSizeParam(catalogPaginationPageSizeSchema),
  limit: deprecatedPaginationLimitParam(catalogPaginationPageSizeSchema),
});

export const sectionSchedulesQuerySchema = catalogLocaleQuerySchema.extend({
  dateFrom: dateQuerySchema().optional(),
  dateTo: dateQuerySchema().optional(),
  limit: sectionScheduleLimitSchema.optional(),
});

export const sectionDetailQuerySchema = catalogLocaleQuerySchema.extend({
  includeExams: booleanQuerySchema.optional(),
  includeSchedules: booleanQuerySchema.optional(),
  includeTeacherDepartments: booleanQuerySchema.optional(),
});

export const teachersQuerySchema = catalogLocaleQuerySchema.extend({
  departmentId: catalogIdSchema.optional(),
  search: catalogSearchSchema.optional(),
  page: catalogPageSchema.optional(),
  pageSize: paginationPageSizeParam(catalogPaginationPageSizeSchema),
  limit: deprecatedPaginationLimitParam(catalogPaginationPageSizeSchema),
});

export const coursesQuerySchema = catalogLocaleQuerySchema.extend({
  search: catalogSearchSchema.optional(),
  educationLevelId: catalogIdSchema.optional(),
  categoryId: catalogIdSchema.optional(),
  classTypeId: catalogIdSchema.optional(),
  page: catalogPageSchema.optional(),
  pageSize: paginationPageSizeParam(catalogPaginationPageSizeSchema),
  limit: deprecatedPaginationLimitParam(catalogPaginationPageSizeSchema),
});
