import * as z from "zod";
import { APP_LOCALES } from "@/i18n/config";
import {
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
  locale: z.enum(APP_LOCALES).optional(),
});

export const sectionsQuerySchema = catalogLocaleQuerySchema.extend({
  courseId: integerStringSchema.optional(),
  courseJwId: integerStringSchema.optional(),
  semesterId: integerStringSchema.optional(),
  semesterJwId: integerStringSchema.optional(),
  campusId: integerStringSchema.optional(),
  departmentId: integerStringSchema.optional(),
  teacherId: integerStringSchema.optional(),
  teacherCode: z.string().trim().min(1).optional(),
  search: z.string().trim().optional(),
  ids: z.string().trim().optional(),
  jwIds: z.string().trim().optional(),
  page: integerStringSchema.optional(),
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
  page: integerStringSchema.optional(),
  pageSize: paginationPageSizeParam(catalogPaginationPageSizeSchema),
  limit: deprecatedPaginationLimitParam(catalogPaginationPageSizeSchema),
});

export const sectionSchedulesQuerySchema = catalogLocaleQuerySchema.extend({
  dateFrom: dateQuerySchema().optional(),
  dateTo: dateQuerySchema().optional(),
  limit: sectionScheduleLimitSchema.optional(),
});

export const teachersQuerySchema = catalogLocaleQuerySchema.extend({
  departmentId: integerStringSchema.optional(),
  search: z.string().trim().optional(),
  page: integerStringSchema.optional(),
  pageSize: paginationPageSizeParam(catalogPaginationPageSizeSchema),
  limit: deprecatedPaginationLimitParam(catalogPaginationPageSizeSchema),
});

export const coursesQuerySchema = catalogLocaleQuerySchema.extend({
  search: z.string().trim().optional(),
  educationLevelId: integerStringSchema.optional(),
  categoryId: integerStringSchema.optional(),
  classTypeId: integerStringSchema.optional(),
  page: integerStringSchema.optional(),
  pageSize: paginationPageSizeParam(catalogPaginationPageSizeSchema),
  limit: deprecatedPaginationLimitParam(catalogPaginationPageSizeSchema),
});
