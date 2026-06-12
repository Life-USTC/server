import * as z from "zod";

export const adminModerateCommentRequestSchema = z.object({
  status: z.enum(["active", "softbanned", "deleted"]),
  moderationNote: z.string().optional().nullable(),
});

export const adminCreateSuspensionRequestSchema = z.object({
  userId: z.string().trim().min(1),
  reason: z.string().optional(),
  note: z.string().optional(),
  expiresAt: z.union([z.string(), z.null()]).optional(),
});

export const adminUpdateUserRequestSchema = z.object({
  name: z.union([z.string(), z.null()]).optional(),
  username: z.union([z.string(), z.null()]).optional(),
  isAdmin: z.boolean().optional(),
});
