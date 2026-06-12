import * as z from "zod";
import {
  descriptionTargetTypeSchema,
  parseOptionalInt,
} from "./request-schema-primitives";

export const descriptionUpsertRequestSchema = z
  .object({
    targetType: descriptionTargetTypeSchema,
    targetId: z.union([z.string(), z.number()]),
    content: z.string().max(4000),
  })
  .superRefine((input, ctx) => {
    if (input.targetType === "homework") {
      if (
        typeof input.targetId !== "string" ||
        input.targetId.trim().length === 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Homework targetId must be a non-empty string",
          path: ["targetId"],
        });
      }
      return;
    }

    const parsed = parseOptionalInt(input.targetId);
    if (!parsed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "targetId must be a valid integer for numeric targets",
        path: ["targetId"],
      });
    }
  });

export type DescriptionUpsertRequest = z.infer<
  typeof descriptionUpsertRequestSchema
>;
