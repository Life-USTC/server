import * as z from "zod";
import { sectionCodeSchema } from "@/features/catalog/lib/section-code-schema";
import { commentTargetTypeSchema } from "@/features/comments/lib/comment-target-input-schemas";
import { todoPrioritySchema } from "@/features/todos/lib/todo-schema";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { startOfShanghaiDay } from "@/lib/time/shanghai-format";
import { parseInteger } from "../request-integers";
import { commentVisibilitySchema } from "./shared-enum-schemas";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

export function integerStringRangeSchema({
  maximum,
  message,
  minimum,
}: {
  maximum: number;
  message: string;
  minimum: number;
}) {
  return integerStringSchema
    .refine(
      (value) => {
        const parsed = parseInteger(value);
        return parsed !== null && parsed >= minimum && parsed <= maximum;
      },
      { message },
    )
    .meta({
      override: {
        type: "integer",
        format: "int64",
        minimum,
        maximum,
      },
    });
}

export const integerQuerySchema = integerStringSchema
  .transform((value) => Number(value))
  .meta({ override: { type: "integer", format: "int64" } });

export function integerQueryRangeSchema({
  maximum,
  message,
  minimum,
}: {
  maximum?: number;
  message: string;
  minimum: number;
}) {
  return integerQuerySchema
    .refine(
      (value) => {
        return value >= minimum && (maximum === undefined || value <= maximum);
      },
      { message },
    )
    .meta({
      override: {
        type: "integer",
        format: "int64",
        minimum,
        ...(maximum === undefined ? {} : { maximum }),
      },
    });
}

export function paginationPageSizeParam<TSchema extends z.ZodType>(
  schema: TSchema,
) {
  return schema.optional().meta({
    param: { description: "Number of items per page." },
  });
}

export function deprecatedPaginationLimitParam<TSchema extends z.ZodType>(
  schema: TSchema,
) {
  return schema.optional().meta({
    param: {
      deprecated: true,
      description:
        "Deprecated alias for pageSize. pageSize takes precedence when both are supplied.",
    },
  });
}

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

export function dateQuerySchema(
  options: { dateOnlyAsShanghaiStart?: boolean } = {},
) {
  return dateInputStringSchema
    .transform((value) => {
      const parsed = parseDateInput(value);
      if (!(parsed instanceof Date)) {
        throw new TypeError("Validated date query could not be parsed");
      }

      return options.dateOnlyAsShanghaiStart && DATE_ONLY_PATTERN.test(value)
        ? startOfShanghaiDay(parsed)
        : parsed;
    })
    .meta({
      override: {
        type: "string",
        minLength: 1,
        description: "YYYY-MM-DD or ISO date/time accepted by parseDateInput",
      },
    });
}

export const booleanQuerySchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .meta({ override: { type: "string", enum: ["true", "false"] } });

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
