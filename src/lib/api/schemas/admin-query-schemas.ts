import * as z from "zod";
import { ADMIN_COMMENT_STATUS_FILTERS } from "@/features/admin/lib/admin-moderation-filters";
import {
  deprecatedPaginationLimitParam,
  integerStringSchema,
  paginationPageSizeParam,
} from "./request-schema-primitives";

export const adminUsersQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: integerStringSchema.optional(),
  pageSize: paginationPageSizeParam(integerStringSchema),
  limit: deprecatedPaginationLimitParam(integerStringSchema),
});

export const adminCommentsQuerySchema = z.object({
  status: z.enum(ADMIN_COMMENT_STATUS_FILTERS).optional(),
  pageSize: paginationPageSizeParam(integerStringSchema),
  limit: deprecatedPaginationLimitParam(integerStringSchema),
});

export const adminHomeworksQuerySchema = z.object({
  status: z.enum(["all", "active", "deleted"]).optional(),
  search: z.string().trim().optional(),
  pageSize: paginationPageSizeParam(integerStringSchema),
  limit: deprecatedPaginationLimitParam(integerStringSchema),
});

export const adminDescriptionsQuerySchema = z.object({
  targetType: z
    .enum(["all", "section", "course", "teacher", "homework"])
    .optional(),
  hasContent: z.enum(["all", "withContent", "empty"]).optional(),
  search: z.string().trim().optional(),
  pageSize: paginationPageSizeParam(integerStringSchema),
  limit: deprecatedPaginationLimitParam(integerStringSchema),
});
