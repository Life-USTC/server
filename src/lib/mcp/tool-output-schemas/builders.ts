import { z } from "zod";
import { courseSchema } from "@/lib/api/schemas/academic-course-response-schemas";
import { subscribedExamSchema } from "@/lib/api/schemas/academic-exam-response-schemas";
import { campusSchema } from "@/lib/api/schemas/academic-location-response-schemas";
import {
  paginatedCourseResponseSchema,
  paginatedSectionResponseSchema,
  paginatedSemesterResponseSchema,
  paginatedTeacherResponseSchema,
} from "@/lib/api/schemas/academic-paginated-response-schemas";
import { semesterSchema } from "@/lib/api/schemas/academic-section-base-response-schemas";
import { sectionPublicContextSchema } from "@/lib/api/schemas/academic-section-list-response-schemas";
import {
  courseDetailSchema,
  courseDetailSectionSchema,
  sectionCompactSchema,
  sectionDetailSchema,
  sectionSummarySchema,
  teacherDetailSchema,
} from "@/lib/api/schemas/academic-section-response-schemas";
import {
  departmentSummarySchema,
  teacherListSchema,
} from "@/lib/api/schemas/academic-teacher-response-schemas";
import { descriptionDetailSchema } from "@/lib/api/schemas/descriptions-response-schemas";
import {
  matchSectionCodesResponseSchema,
  viewerContextSchema,
} from "@/lib/api/schemas/misc-response-schema-core";
import { dateTimeSchema } from "@/lib/api/schemas/response-schema-primitives";
import {
  paginatedScheduleResponseSchema,
  scheduleEntrySchema,
  sectionScheduleWithContextSchema,
  subscribedScheduleEntrySchema,
} from "@/lib/api/schemas/schedule-response-schema-core";
import {
  uploadDeleteResponseSchema,
  uploadRenameResponseSchema,
  uploadSummarySchema,
  uploadsListResponseSchema,
} from "@/lib/api/schemas/uploads-response-schemas";

export type OutputShape = Record<string, z.ZodType>;

export type McpToolOutputSchema = z.ZodType;

export const COMMON_OUTPUT_SHAPE = {
  success: z.boolean(),
  found: z.boolean().optional(),
  error: z.unknown().optional(),
  message: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  hint: z.string().optional(),
  result: z.unknown().optional(),
} satisfies OutputShape;

export const STRUCTURED_CONTENT_OUTPUT_SCHEMA = z
  .object(COMMON_OUTPUT_SHAPE)
  .strict()
  .describe("Object returned in structuredContent with an explicit status.");

export function optionalizeShape(shape: OutputShape) {
  return Object.fromEntries(
    Object.entries(shape).map(([key, schema]) => [key, schema.optional()]),
  ) as OutputShape;
}

export function objectOutputSchema(shape: OutputShape) {
  return z
    .object({
      ...optionalizeShape(shape),
      ...COMMON_OUTPUT_SHAPE,
    })
    .strict()
    .describe("Canonical object returned in structuredContent.");
}

export function objectOutputSchemaFromApi(schema: { shape: OutputShape }) {
  return objectOutputSchema(schema.shape);
}

export function topLevelOutputSchema(keys: string[]) {
  return objectOutputSchema(
    Object.fromEntries(keys.map((key) => [key, z.unknown()])) as OutputShape,
  );
}

export function collectionOutputSchema(itemSchema: z.ZodType) {
  return z.array(itemSchema);
}

export function compactObjectSchema(shape: OutputShape) {
  return z.object(optionalizeShape(shape)).catchall(z.unknown());
}

export const compactUserSchema = z.strictObject({
  id: z.string(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  image: z.string().nullable(),
});

export const compactDepartmentSchema = departmentSummarySchema
  .pick({
    id: true,
    nameCn: true,
    nameEn: true,
    namePrimary: true,
    nameSecondary: true,
  })
  .strict();

export const compactCourseSchema = courseSchema
  .pick({
    id: true,
    jwId: true,
    code: true,
    nameCn: true,
    nameEn: true,
    namePrimary: true,
    nameSecondary: true,
  })
  .strict();

export const compactCourseReferenceSchema = compactCourseSchema.omit({
  id: true,
});

export const compactSemesterFields = semesterSchema.pick({
  id: true,
  jwId: true,
  code: true,
  nameCn: true,
  startDate: true,
  endDate: true,
}).shape;
export const compactSemesterSchema = z.object(compactSemesterFields).strict();
export const compactSemesterReferenceSchema = compactSemesterSchema.pick({
  jwId: true,
  code: true,
  nameCn: true,
});

export const compactCampusSchema = campusSchema
  .pick({
    id: true,
    nameCn: true,
    nameEn: true,
    namePrimary: true,
    nameSecondary: true,
  })
  .extend({
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
  })
  .strict();

export function exactSuccessOutput(shape: OutputShape) {
  return z.strictObject({ success: z.literal(true), ...shape });
}

export const exactFailureOutputSchema = z.strictObject({
  success: z.literal(false),
  found: z.literal(false).optional(),
  message: z.string(),
  hint: z.string().optional(),
});

export {
  courseDetailSchema,
  courseDetailSectionSchema,
  courseSchema,
  dateTimeSchema,
  descriptionDetailSchema,
  matchSectionCodesResponseSchema,
  paginatedCourseResponseSchema,
  paginatedScheduleResponseSchema,
  paginatedSectionResponseSchema,
  paginatedSemesterResponseSchema,
  paginatedTeacherResponseSchema,
  scheduleEntrySchema,
  sectionCompactSchema,
  sectionDetailSchema,
  sectionPublicContextSchema,
  sectionScheduleWithContextSchema,
  sectionSummarySchema,
  subscribedExamSchema,
  subscribedScheduleEntrySchema,
  teacherDetailSchema,
  teacherListSchema,
  uploadDeleteResponseSchema,
  uploadRenameResponseSchema,
  uploadSummarySchema,
  uploadsListResponseSchema,
  viewerContextSchema,
};
