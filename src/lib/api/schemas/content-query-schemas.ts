import * as z from "zod";
import { commentTargetQueryInputSchema } from "@/features/comments/lib/comment-target-input-schemas";
import {
  HOMEWORK_LIST_MAX_PAGE,
  HOMEWORK_LIST_MAX_PAGE_SIZE,
  HOMEWORK_LIST_MAX_SECTION_IDS,
} from "@/features/homeworks/lib/homework-list-bounds";
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

const homeworkPageSchema = integerStringRangeSchema({
  minimum: 1,
  maximum: HOMEWORK_LIST_MAX_PAGE,
  message: `page must be between 1 and ${HOMEWORK_LIST_MAX_PAGE}`,
});

const homeworkPageSizeSchema = integerStringRangeSchema({
  minimum: 1,
  maximum: HOMEWORK_LIST_MAX_PAGE_SIZE,
  message: `pageSize must be between 1 and ${HOMEWORK_LIST_MAX_PAGE_SIZE}`,
});

const homeworkSectionIdsSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => {
      const entries = value.split(",");
      return (
        entries.length <= HOMEWORK_LIST_MAX_SECTION_IDS &&
        entries.every(
          (entry) => /^\d+$/.test(entry.trim()) && Number(entry) > 0,
        )
      );
    },
    {
      message: `sectionIds must contain at most ${HOMEWORK_LIST_MAX_SECTION_IDS} positive integers`,
    },
  )
  .meta({
    param: {
      description: `Comma-separated positive section IDs, at most ${HOMEWORK_LIST_MAX_SECTION_IDS} entries.`,
    },
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
  sectionIds: homeworkSectionIdsSchema.optional(),
  sectionJwId: integerStringSchema.optional(),
  includeDeleted: booleanQuerySchema.optional(),
  page: homeworkPageSchema.optional(),
  pageSize: paginationPageSizeParam(homeworkPageSizeSchema),
});

export const subscribedHomeworksQuerySchema = z.object({
  page: homeworkPageSchema.optional(),
  pageSize: paginationPageSizeParam(homeworkPageSizeSchema),
});

export const sectionsCalendarQuerySchema = z.object({
  sectionIds: z
    .string()
    .trim()
    .min(1)
    .describe(
      "Comma-separated positive Section database IDs; at most 50 unique IDs.",
    ),
});

export const userCalendarQuerySchema = z.object({
  token: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Calendar feed token for anonymous personal iCal access."),
});
