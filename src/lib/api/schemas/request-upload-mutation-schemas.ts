import * as z from "zod";
import { hasAsciiControlCharacters } from "@/lib/text/ascii-control-characters";

const filenameControlCharacterMessage =
  "Filename contains unsupported control characters";

const uploadFilenameSchema = z
  .string()
  .refine((filename) => !hasAsciiControlCharacters(filename), {
    message: filenameControlCharacterMessage,
  })
  .trim()
  .min(1);

const uploadRenameFilenameSchema = uploadFilenameSchema.max(255);

export const uploadCreateRequestSchema = z.object({
  filename: uploadFilenameSchema,
  contentType: z.string().optional(),
  size: z.union([z.string(), z.number()]),
});

export const uploadCompleteRequestSchema = z.object({
  key: z.string().trim().min(1),
  filename: uploadFilenameSchema,
  contentType: z.string().optional(),
});

export const uploadRenameRequestSchema = z.object({
  filename: uploadRenameFilenameSchema,
});
