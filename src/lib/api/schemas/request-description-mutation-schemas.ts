import * as z from "zod";
import type { JSONSchema } from "zod/v4/core";
import { DESCRIPTION_CONTENT_MAX_LENGTH } from "@/features/descriptions/lib/description-limits";
import {
  descriptionTargetTypeSchema,
  parseOptionalInt,
} from "./request-schema-primitives";

const descriptionTargetIdReferenceSchema = z.union([
  z.string().trim().min(1),
  z.number(),
]);

const descriptionTargetReferenceOpenApiAnyOf: JSONSchema.JSONSchema[] = [
  { required: ["targetId"] },
  {
    properties: { targetType: { enum: ["section"], type: "string" } },
    required: ["sectionJwId"],
  },
  {
    properties: { targetType: { enum: ["course"], type: "string" } },
    required: ["courseJwId"],
  },
  {
    properties: { targetType: { enum: ["teacher"], type: "string" } },
    required: ["teacherId"],
  },
  {
    properties: { targetType: { enum: ["homework"], type: "string" } },
    required: ["homeworkId"],
  },
];

function hasReference(value: unknown) {
  return value !== undefined && value !== null;
}

function addMissingReferenceIssue(
  ctx: z.RefinementCtx,
  targetPath: string,
  message: string,
) {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message,
    path: [targetPath],
  });
}

function addInvalidIntegerIssue(ctx: z.RefinementCtx, targetPath: string) {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: `${targetPath} must be a valid integer`,
    path: [targetPath],
  });
}

function requirePositiveIntegerReference(
  ctx: z.RefinementCtx,
  value: unknown,
  targetPath: string,
) {
  if (!hasReference(value)) return;
  const parsed = parseOptionalInt(value);
  if (parsed === null || parsed < 1) {
    addInvalidIntegerIssue(ctx, targetPath);
  }
}

export const descriptionUpsertRequestSchema = z
  .object({
    targetType: descriptionTargetTypeSchema,
    targetId: descriptionTargetIdReferenceSchema.optional(),
    sectionJwId: descriptionTargetIdReferenceSchema.optional(),
    courseJwId: descriptionTargetIdReferenceSchema.optional(),
    teacherId: descriptionTargetIdReferenceSchema.optional(),
    homeworkId: z.string().trim().min(1).optional(),
    content: z.string().max(DESCRIPTION_CONTENT_MAX_LENGTH),
  })
  .superRefine((input, ctx) => {
    if (input.targetType === "section") {
      if (!hasReference(input.targetId) && !hasReference(input.sectionJwId)) {
        addMissingReferenceIssue(
          ctx,
          "targetId",
          "Provide targetId or sectionJwId for section descriptions",
        );
      }
      requirePositiveIntegerReference(ctx, input.targetId, "targetId");
      requirePositiveIntegerReference(ctx, input.sectionJwId, "sectionJwId");
      return;
    }

    if (input.targetType === "course") {
      if (!hasReference(input.targetId) && !hasReference(input.courseJwId)) {
        addMissingReferenceIssue(
          ctx,
          "targetId",
          "Provide targetId or courseJwId for course descriptions",
        );
      }
      requirePositiveIntegerReference(ctx, input.targetId, "targetId");
      requirePositiveIntegerReference(ctx, input.courseJwId, "courseJwId");
      return;
    }

    if (input.targetType === "teacher") {
      if (!hasReference(input.targetId) && !hasReference(input.teacherId)) {
        addMissingReferenceIssue(
          ctx,
          "targetId",
          "Provide targetId or teacherId for teacher descriptions",
        );
      }
      requirePositiveIntegerReference(ctx, input.targetId, "targetId");
      requirePositiveIntegerReference(ctx, input.teacherId, "teacherId");
      return;
    }

    if (!hasReference(input.targetId) && !hasReference(input.homeworkId)) {
      addMissingReferenceIssue(
        ctx,
        "targetId",
        "Provide targetId or homeworkId for homework descriptions",
      );
    }
  })
  .meta({
    override: {
      anyOf: descriptionTargetReferenceOpenApiAnyOf,
    },
  });

export type DescriptionUpsertRequest = z.infer<
  typeof descriptionUpsertRequestSchema
>;
