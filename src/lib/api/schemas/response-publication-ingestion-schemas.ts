import * as z from "zod";
import { dateTimeSchema } from "./response-schema-primitives";

export const publicationIngestionItemResultSchema = z.strictObject({
  canonicalUrl: z.string().url(),
  status: z.enum(["created", "updated", "unchanged", "rejected"]),
  publicationId: z.string().nullable(),
  revisionId: z.string().nullable(),
  error: z.string().optional(),
});

export const publicationIngestionBatchResponseSchema = z.strictObject({
  batchId: z.string(),
  clientRunId: z.string(),
  payloadDigest: z.string(),
  results: z.array(publicationIngestionItemResultSchema),
});

export const publicationObjectPlanItemSchema = z.strictObject({
  kind: z.enum(["body_html", "body_markdown", "media", "asset", "raw_page"]),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  r2Key: z.string(),
  status: z.enum(["already_present", "upload_required"]),
  uploadUrl: z.string().url().nullable(),
  expiresAt: dateTimeSchema.nullable(),
  requiredHeaders: z.strictObject({
    "Content-Type": z.string(),
    "x-amz-meta-kind": z.string(),
    "x-amz-meta-sha256": z.string(),
  }),
});

export const publicationObjectPlanResponseSchema = z.strictObject({
  batchId: z.string(),
  objects: z.array(publicationObjectPlanItemSchema),
});

export const publicationObjectCompleteResponseSchema = z.strictObject({
  batchId: z.string(),
  kind: z.enum(["body_html", "body_markdown", "media", "asset", "raw_page"]),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(["verified", "linked"]),
});
