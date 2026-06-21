import * as z from "zod";
import { sectionCodeSchema } from "@/features/catalog/lib/section-code-schema";
import { todoPrioritySchema } from "@/features/todos/lib/todo-schema";
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

export { commentVisibilitySchema, sectionCodeSchema };

export const commentTargetTypeSchema = z.enum([
  "section",
  "course",
  "teacher",
  "section-teacher",
  "homework",
]);

export const descriptionTargetTypeSchema = z.enum([
  "section",
  "course",
  "teacher",
  "homework",
]);

export { parseOptionalInt, parseOptionalIntLike, todoPrioritySchema };
