import * as z from "zod";
import { commentTargetQueryInputSchema } from "@/features/comments/lib/comment-target-input-schemas";
import {
  booleanQuerySchema,
  deprecatedPaginationLimitParam,
  descriptionTargetTypeSchema,
  integerStringRangeSchema,
  integerStringSchema,
  paginationPageSizeParam,
} from "./request-schema-primitives";

const publicPageSizeSchema = integerStringRangeSchema({
  minimum: 1,
  maximum: 100,
  message: "pageSize must be between 1 and 100",
});

export const commentsQuerySchema = commentTargetQueryInputSchema.extend({
  page: integerStringSchema.optional(),
  pageSize: paginationPageSizeParam(publicPageSizeSchema),
  limit: deprecatedPaginationLimitParam(publicPageSizeSchema),
});

export const uploadsQuerySchema = z.object({
  page: integerStringSchema.optional(),
  pageSize: paginationPageSizeParam(publicPageSizeSchema),
  limit: deprecatedPaginationLimitParam(publicPageSizeSchema),
});

export const descriptionsQuerySchema = z.object({
  targetType: descriptionTargetTypeSchema,
  targetId: z.string().trim().min(1).optional(),
  sectionJwId: integerStringSchema.optional(),
  courseJwId: integerStringSchema.optional(),
  teacherId: integerStringSchema.optional(),
  homeworkId: z.string().trim().min(1).optional(),
});

export const homeworksQuerySchema = z.object({
  sectionId: integerStringSchema.optional(),
  sectionIds: z.string().trim().min(1).optional(),
  sectionJwId: integerStringSchema.optional(),
  includeDeleted: booleanQuerySchema.optional(),
});

export const sectionsCalendarQuerySchema = z.object({
  sectionIds: z.string().trim().min(1),
});

export const userCalendarQuerySchema = z.object({
  token: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Calendar feed token for anonymous personal iCal access."),
});
