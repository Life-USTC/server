import * as z from "zod";
import {
  createPaginatedSchema,
  dateTimeSchema,
} from "./response-schema-primitives";

const adminUserListItemSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  isAdmin: z.boolean(),
  createdAt: dateTimeSchema,
  email: z.string().nullable(),
});

export const adminUsersResponseSchema = createPaginatedSchema(
  adminUserListItemSchema,
);

export const adminUserResponseSchema = z.object({
  user: adminUserListItemSchema,
});
