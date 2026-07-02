import * as z from "zod";
import { dateTimeSchema } from "./response-schema-primitives";

export const uploadSummarySchema = z.object({
  id: z.string(),
  key: z.string(),
  filename: z.string(),
  size: z.number().int(),
  createdAt: dateTimeSchema,
});

export const uploadsListResponseSchema = z.object({
  maxFileSizeBytes: z.number().int(),
  quotaBytes: z.number().int(),
  uploads: z.array(uploadSummarySchema),
  usedBytes: z.number().int(),
});

export const uploadCreateResponseSchema = z.object({
  key: z.string(),
  url: z.string(),
  maxFileSizeBytes: z.number().int(),
  quotaBytes: z.number().int(),
  usedBytes: z.number().int(),
});

export const uploadCompleteResponseSchema = z.object({
  upload: uploadSummarySchema,
  usedBytes: z.number().int(),
  quotaBytes: z.number().int(),
});

export const uploadRenameResponseSchema = z.object({
  upload: uploadSummarySchema,
});

export const uploadDeleteResponseSchema = z.object({
  deletedId: z.string(),
  deletedSize: z.number().int(),
});
