import * as z from "zod";

export const uploadCreateRequestSchema = z.object({
  filename: z.string().trim().min(1),
  contentType: z.string().optional(),
  size: z.union([z.string(), z.number()]),
});

export const uploadCompleteRequestSchema = z.object({
  key: z.string().trim().min(1),
  filename: z.string().trim().min(1),
  contentType: z.string().optional(),
});

export const uploadRenameRequestSchema = z.object({
  filename: z.string().trim().min(1).max(255),
});
