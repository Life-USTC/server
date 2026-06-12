import * as z from "zod";
import { integerStringSchema } from "./request-schema-primitives";

export const sectionsQuerySchema = z.object({
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
  limit: integerStringSchema.optional(),
});

export const schedulesQuerySchema = z.object({
  sectionId: integerStringSchema.optional(),
  sectionJwId: integerStringSchema.optional(),
  sectionCode: z.string().trim().min(1).optional(),
  teacherId: integerStringSchema.optional(),
  teacherCode: z.string().trim().min(1).optional(),
  roomId: integerStringSchema.optional(),
  roomJwId: integerStringSchema.optional(),
  weekday: integerStringSchema.optional(),
  dateFrom: z.string().trim().datetime().optional(),
  dateTo: z.string().trim().datetime().optional(),
  page: integerStringSchema.optional(),
  limit: integerStringSchema.optional(),
});

export const teachersQuerySchema = z.object({
  departmentId: integerStringSchema.optional(),
  search: z.string().trim().optional(),
  page: integerStringSchema.optional(),
  limit: integerStringSchema.optional(),
});

export const coursesQuerySchema = z.object({
  search: z.string().trim().optional(),
  educationLevelId: integerStringSchema.optional(),
  categoryId: integerStringSchema.optional(),
  classTypeId: integerStringSchema.optional(),
  page: integerStringSchema.optional(),
  limit: integerStringSchema.optional(),
});
