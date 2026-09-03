import * as z from "zod";

export const publicationIngestionItemResultSchema = z.strictObject({
  canonicalUrl: z.string().url(),
  sourceId: z.string().min(1),
  revisionHash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(["created", "updated", "unchanged", "rejected"]),
  publicationId: z.string().nullable(),
  revisionId: z.string().nullable(),
  error: z.string().optional(),
});

export const publicationIngestionBatchResponseSchema = z.strictObject({
  batchId: z.string().min(1),
  clientRunId: z.string().min(1),
  payloadDigest: z.string().regex(/^[a-f0-9]{64}$/),
  results: z.array(publicationIngestionItemResultSchema),
});

export const publicationObjectPlanItemSchema = z.strictObject({
  kind: z.enum(["body_html", "body_markdown", "media", "asset", "raw_page"]),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  r2Key: z.string(),
  status: z.enum(["already_present", "upload_required"]),
  uploadUrl: z.string().url().nullable(),
  requiredHeaders: z.strictObject({
    "Content-Type": z.string(),
  }),
});

export const publicationObjectPlanResponseSchema = z.strictObject({
  batchId: z.string(),
  objects: z.array(publicationObjectPlanItemSchema),
});

export const publicationObjectUploadResponseSchema = z.strictObject({
  batchId: z.string(),
  kind: z.enum(["body_html", "body_markdown", "media", "asset", "raw_page"]),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.literal("linked"),
});
