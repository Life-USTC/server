import * as z from "zod";

export const subscriptionKindSchema = z.enum([
  "regular",
  "auditor",
  "teaching_assistant",
]);
export type SubscriptionKind = z.infer<typeof subscriptionKindSchema>;
