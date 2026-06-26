import * as z from "zod";
import { parseInteger } from "@/lib/integers";
import { COMMENT_TARGET_TYPES } from "./comment-target-types";

export const commentTargetTypeSchema = z.enum(COMMENT_TARGET_TYPES);

const commentTargetIdReferenceSchema = z.union([z.string(), z.number()]);

const commentTargetIntegerStringSchema = z
  .string()
  .trim()
  .refine((value) => parseInteger(value) !== null, {
    message: "Invalid integer",
  })
  .meta({ override: { type: "integer", format: "int64" } });

const positiveIntegerTargetIdReferenceSchema = z.union([
  z
    .string()
    .trim()
    .refine(
      (value) => {
        const parsed = parseInteger(value);
        return parsed !== null && parsed > 0;
      },
      { message: "Invalid integer" },
    )
    .meta({ override: { type: "integer", format: "int64", minimum: 1 } }),
  z
    .number()
    .int()
    .min(1)
    .meta({ override: { type: "integer", minimum: 1 } }),
]);

const mcpCommentTargetIdSchema = z.union([
  z.number().int().positive(),
  z.string().trim().min(1),
]);

const mcpPositiveIntegerTargetIdSchema = z.number().int().positive();

export const commentTargetQueryInputSchema = z.object({
  targetType: commentTargetTypeSchema,
  targetId: z.string().optional(),
  sectionId: commentTargetIntegerStringSchema.optional(),
  sectionJwId: commentTargetIntegerStringSchema.optional(),
  courseJwId: commentTargetIntegerStringSchema.optional(),
  teacherId: commentTargetIntegerStringSchema.optional(),
  homeworkId: z.string().trim().min(1).optional(),
  sectionTeacherId: commentTargetIntegerStringSchema.optional(),
});

export const commentTargetMutationInputSchema = z.object({
  targetType: commentTargetTypeSchema,
  targetId: commentTargetIdReferenceSchema.optional(),
  sectionId: commentTargetIdReferenceSchema.optional(),
  sectionJwId: positiveIntegerTargetIdReferenceSchema.optional(),
  courseJwId: positiveIntegerTargetIdReferenceSchema.optional(),
  teacherId: commentTargetIdReferenceSchema.optional(),
  homeworkId: z.string().trim().min(1).optional(),
  sectionTeacherId: positiveIntegerTargetIdReferenceSchema.optional(),
});

export const commentMcpTargetReadInputSchema = z.object({
  targetType: commentTargetTypeSchema,
  targetId: mcpCommentTargetIdSchema
    .optional()
    .describe(
      "Internal target id matching REST /api/comments. Prefer public identifiers such as sectionJwId or courseJwId when available.",
    ),
  sectionJwId: mcpPositiveIntegerTargetIdSchema
    .optional()
    .describe("Public JW section id for section or section-teacher comments."),
  courseJwId: mcpPositiveIntegerTargetIdSchema
    .optional()
    .describe("Public JW course id for course comments."),
  teacherId: mcpPositiveIntegerTargetIdSchema
    .optional()
    .describe("Teacher id for teacher or section-teacher comments."),
  homeworkId: z.string().trim().min(1).optional(),
  sectionTeacherId: mcpPositiveIntegerTargetIdSchema
    .optional()
    .describe("Direct section-teacher relationship id."),
});

export const commentMcpTargetMutationInputSchema =
  commentMcpTargetReadInputSchema.extend({
    sectionId: mcpCommentTargetIdSchema
      .optional()
      .describe("Internal section id for section-teacher comments."),
    teacherId: mcpCommentTargetIdSchema
      .optional()
      .describe("Teacher id for teacher or section-teacher comments."),
  });
