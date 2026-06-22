import * as z from "zod";
import {
  homeworkDateInputSchema,
  homeworkDescriptionInputSchema,
  homeworkTitleSchema,
} from "@/features/homeworks/lib/homework-schema";
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

const homeworkCreateBaseRequestSchema = z.object({
  title: homeworkTitleSchema,
  description: homeworkDescriptionInputSchema,
  publishedAt: homeworkDateInputSchema,
  submissionStartAt: homeworkDateInputSchema,
  submissionDueAt: homeworkDateInputSchema,
  isMajor: z.boolean().optional(),
  requiresTeam: z.boolean().optional(),
});

export const homeworkCreateRequestSchema = z.union([
  homeworkCreateBaseRequestSchema.extend({
    sectionId: z.union([z.string(), z.number()]),
    sectionJwId: z.union([z.string(), z.number()]).optional(),
  }),
  homeworkCreateBaseRequestSchema.extend({
    sectionId: z.union([z.string(), z.number()]).optional(),
    sectionJwId: z.union([z.string(), z.number()]),
  }),
]);

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
  title: homeworkTitleSchema.optional(),
  description: homeworkDescriptionInputSchema,
  publishedAt: homeworkDateInputSchema,
  submissionStartAt: homeworkDateInputSchema,
  submissionDueAt: homeworkDateInputSchema,
  isMajor: z.boolean().optional(),
  requiresTeam: z.boolean().optional(),
});

export type MatchSectionCodesRequest = z.infer<
  typeof matchSectionCodesRequestSchema
>;

export type HomeworkCreateRequest = z.infer<typeof homeworkCreateRequestSchema>;
