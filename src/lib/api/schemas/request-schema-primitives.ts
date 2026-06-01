import * as z from "zod";
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
  .meta({ openapiType: "integer" });

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

export const sectionCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_.-]+$/);

export { commentVisibilitySchema };

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

export const todoPrioritySchema = z.enum(["low", "medium", "high"]);

export { parseOptionalInt, parseOptionalIntLike };
