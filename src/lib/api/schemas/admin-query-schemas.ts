import * as z from "zod";
import { integerStringSchema } from "./request-schema-primitives";

export const adminUsersQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: integerStringSchema.optional(),
  limit: integerStringSchema.optional(),
});

export const adminCommentsQuerySchema = z.object({
  status: z.enum(["active", "softbanned", "deleted", "suspended"]).optional(),
  limit: integerStringSchema.optional(),
});

export const adminHomeworksQuerySchema = z.object({
  status: z.enum(["all", "active", "deleted"]).optional(),
  search: z.string().trim().optional(),
  limit: integerStringSchema.optional(),
});

export const adminDescriptionsQuerySchema = z.object({
  targetType: z
    .enum(["all", "section", "course", "teacher", "homework"])
    .optional(),
  hasContent: z.enum(["all", "withContent", "empty"]).optional(),
  search: z.string().trim().optional(),
  limit: integerStringSchema.optional(),
});
