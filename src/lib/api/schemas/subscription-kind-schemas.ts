import * as z from "zod";
import { subscriptionKindSchema } from "@/features/subscriptions/lib/subscription-kind";

export const subscriptionKindUpdateRequestSchema = z.strictObject({
  kind: subscriptionKindSchema,
});

export const subscriptionKindUpdateResponseSchema = z.strictObject({
  sectionJwId: z.number().int().positive(),
  kind: subscriptionKindSchema,
});
