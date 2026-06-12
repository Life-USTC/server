import * as z from "zod";
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
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).optional(),
  publishedAt: z.union([z.string(), z.null()]).optional(),
  submissionStartAt: z.union([z.string(), z.null()]).optional(),
  submissionDueAt: z.union([z.string(), z.null()]).optional(),
  isMajor: z.boolean().optional(),
  requiresTeam: z.boolean().optional(),
});

export const homeworkCompletionRequestSchema = z.object({
  completed: z.boolean(),
});

export const homeworkUpdateRequestSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
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
