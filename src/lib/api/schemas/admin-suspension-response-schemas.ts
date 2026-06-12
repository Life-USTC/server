import * as z from "zod";
import {
  createCollectionSchema,
  dateTimeSchema,
} from "./response-schema-primitives";

const adminSuspensionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdById: z.string(),
  createdAt: dateTimeSchema,
  reason: z.string().nullable(),
  note: z.string().nullable(),
  expiresAt: dateTimeSchema.nullable(),
  liftedAt: dateTimeSchema.nullable(),
  liftedById: z.string().nullable(),
  user: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

export const adminSuspensionsResponseSchema = createCollectionSchema(
  "suspensions",
  adminSuspensionSchema,
);

export const adminSuspensionResponseSchema = z.object({
  suspension: adminSuspensionSchema,
});
