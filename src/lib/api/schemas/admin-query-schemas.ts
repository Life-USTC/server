import * as z from "zod";
import { ADMIN_COMMENT_STATUS_FILTERS } from "@/features/admin/lib/admin-moderation-filters";
import {
  deprecatedPaginationLimitParam,
  integerStringRangeSchema,
  integerStringSchema,
  paginationPageSizeParam,
} from "./request-schema-primitives";

const adminPageSizeSchema = integerStringRangeSchema({
  minimum: 1,
  maximum: 200,
  message: "pageSize must be between 1 and 200",
});

const adminUsersPageSizeSchema = integerStringRangeSchema({
  minimum: 1,
  maximum: 100,
  message: "pageSize must be between 1 and 100",
});

export const adminUsersQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: integerStringSchema.optional(),
  pageSize: paginationPageSizeParam(adminUsersPageSizeSchema),
  limit: deprecatedPaginationLimitParam(adminUsersPageSizeSchema),
});

export const adminCommentsQuerySchema = z.object({
  status: z.enum(ADMIN_COMMENT_STATUS_FILTERS).optional(),
  page: integerStringSchema.optional(),
  pageSize: paginationPageSizeParam(adminPageSizeSchema),
  limit: deprecatedPaginationLimitParam(adminPageSizeSchema),
});

export const adminHomeworksQuerySchema = z.object({
  status: z.enum(["all", "active", "deleted"]).optional(),
  search: z.string().trim().optional(),
  page: integerStringSchema.optional(),
  pageSize: paginationPageSizeParam(adminPageSizeSchema),
  limit: deprecatedPaginationLimitParam(adminPageSizeSchema),
});

export const adminDescriptionsQuerySchema = z.object({
  targetType: z
    .enum(["all", "section", "course", "teacher", "homework"])
    .optional(),
  hasContent: z.enum(["all", "withContent", "empty"]).optional(),
  search: z.string().trim().optional(),
  page: integerStringSchema.optional(),
  pageSize: paginationPageSizeParam(adminPageSizeSchema),
  limit: deprecatedPaginationLimitParam(adminPageSizeSchema),
});
