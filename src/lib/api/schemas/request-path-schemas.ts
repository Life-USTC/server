import * as z from "zod";
import { integerStringSchema } from "./request-schema-primitives";

export const resourceIdPathParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const teacherIdPathParamsSchema = z.object({
  id: integerStringSchema,
});

export const communityUserIdentifierPathParamsSchema = z.object({
  identifier: z.string().trim().min(1),
});

export const jwIdPathParamsSchema = z.object({
  jwId: integerStringSchema,
});

export const userCalendarPathParamsSchema = z.object({
  userId: z
    .string()
    .trim()
    .min(1)
    .describe(
      "User ID. Token-bearing feed URLs may also use the userId:token path segment form.",
    ),
});

export const calendarFeedCredentialPathParamsSchema = z.object({
  credential: z
    .string()
    .trim()
    .min(1)
    .describe("Opaque user-and-token calendar feed credential."),
});
