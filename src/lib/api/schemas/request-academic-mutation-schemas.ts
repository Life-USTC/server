import * as z from "zod";
import {
  HOMEWORK_DESCRIPTION_MAX_LENGTH,
  HOMEWORK_TITLE_MAX_LENGTH,
} from "@/features/homeworks/lib/homework-limits";
import {
  parseOptionalIntLike,
  sectionCodeSchema,
} from "./request-schema-primitives";

export const matchSectionCodesRequestSchema = z.object({
  codes: z.array(sectionCodeSchema).min(1).max(500),
  semesterId: z
    .preprocess(parseOptionalIntLike, z.union([z.string(), z.number()]))
    .optional(),
});

export const homeworkCreateRequestSchema = z.object({
  sectionId: z.union([z.string(), z.number()]),
  title: z.string().trim().min(1).max(HOMEWORK_TITLE_MAX_LENGTH),
  description: z.string().max(HOMEWORK_DESCRIPTION_MAX_LENGTH).optional(),
  publishedAt: z.union([z.string(), z.null()]).optional(),
  submissionStartAt: z.union([z.string(), z.null()]).optional(),
  submissionDueAt: z.union([z.string(), z.null()]).optional(),
  isMajor: z.boolean().optional(),
  requiresTeam: z.boolean().optional(),
});

export const homeworkCompletionRequestSchema = z.object({
  completed: z.boolean(),
});

export const homeworkCompletionBatchRequestSchema = z.object({
  items: z
    .array(
      z.object({
        homeworkId: z.string().trim().min(1),
        completed: z.boolean(),
      }),
    )
    .min(1)
    .max(100),
});

export const homeworkUpdateRequestSchema = z.object({
  title: z.string().trim().min(1).max(HOMEWORK_TITLE_MAX_LENGTH).optional(),
  description: z
    .string()
    .max(HOMEWORK_DESCRIPTION_MAX_LENGTH)
    .optional()
    .nullable(),
  publishedAt: z.union([z.string(), z.null()]).optional(),
  submissionStartAt: z.union([z.string(), z.null()]).optional(),
  submissionDueAt: z.union([z.string(), z.null()]).optional(),
  isMajor: z.boolean().optional(),
  requiresTeam: z.boolean().optional(),
});

export type MatchSectionCodesRequest = z.infer<
  typeof matchSectionCodesRequestSchema
>;

export type HomeworkCreateRequest = z.infer<typeof homeworkCreateRequestSchema>;
