import * as z from "zod";
import { dateTimeSchema } from "./response-schema-primitives";

const adminUserListItemSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  isAdmin: z.boolean(),
  createdAt: dateTimeSchema,
  email: z.string().nullable(),
});

export const adminUsersResponseSchema = z.object({
  data: z.array(adminUserListItemSchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export const adminUserResponseSchema = z.object({
  user: adminUserListItemSchema,
});
