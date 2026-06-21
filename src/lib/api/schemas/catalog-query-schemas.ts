import * as z from "zod";
import { integerStringSchema } from "./request-schema-primitives";

const weekdayStringSchema = integerStringSchema
  .refine(
    (value) => {
      const weekday = Number.parseInt(value, 10);
      return weekday >= 1 && weekday <= 7;
    },
    { message: "Weekday must be between 1 and 7" },
  )
  .meta({
    override: { type: "integer", format: "int64", minimum: 1, maximum: 7 },
  });

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
  weekday: weekdayStringSchema.optional(),
  dateFrom: z.string().trim().min(1).optional(),
  dateTo: z.string().trim().min(1).optional(),
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
