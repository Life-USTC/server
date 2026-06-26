import * as z from "zod";
import { sectionCodeSchema } from "@/features/catalog/lib/section-code-schema";
import { commentTargetTypeSchema } from "@/features/comments/lib/comment-target-input-schemas";
import { todoPrioritySchema } from "@/features/todos/lib/todo-schema";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { parseInteger } from "../request-integers";
import { commentVisibilitySchema } from "./shared-enum-schemas";

const parseOptionalIntLike = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return value;
};

const parseOptionalInt = (value: unknown) => {
  return parseInteger(value);
};

export const integerStringSchema = z
  .string()
  .trim()
  .refine((value) => parseInteger(value) !== null, {
    message: "Invalid integer",
  })
  .meta({ override: { type: "integer", format: "int64" } });

export const dateInputStringSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => parseDateInput(value) instanceof Date, {
    message: "Invalid date",
  })
  .meta({
    override: {
      type: "string",
      minLength: 1,
      description: "YYYY-MM-DD or ISO date/time accepted by parseDateInput",
    },
  });

export const commentReactionTypeSchema = z.enum([
  "upvote",
  "downvote",
  "heart",
  "laugh",
  "hooray",
  "confused",
  "rocket",
  "eyes",
]);

export { commentTargetTypeSchema, commentVisibilitySchema, sectionCodeSchema };

export const descriptionTargetTypeSchema = z.enum([
  "section",
  "course",
  "teacher",
  "homework",
]);

export { parseOptionalInt, parseOptionalIntLike, todoPrioritySchema };
