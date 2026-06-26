import * as z from "zod";
import { hasFilenameControlCharacters } from "@/features/uploads/lib/upload-utils";

const filenameControlCharacterMessage =
  "Filename contains unsupported control characters";

const uploadFilenameSchema = z
  .string()
  .trim()
  .min(1)
  .refine((filename) => !hasFilenameControlCharacters(filename), {
    message: filenameControlCharacterMessage,
  });

const uploadRenameFilenameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((filename) => !hasFilenameControlCharacters(filename), {
    message: filenameControlCharacterMessage,
  });

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
