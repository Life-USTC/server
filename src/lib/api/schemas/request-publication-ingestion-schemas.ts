import * as z from "zod";
import { parsePublicationDateInput } from "@/features/publications/lib/publication-date";

/** Crawler timestamps may be date-only or Shanghai-local naive datetimes. */
const publicationDateTimeSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => parsePublicationDateInput(value) instanceof Date, {
    message: "Invalid publication date",
  });

export { publicationDateTimeSchema };

const sourceIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9._-]*$/);

const urlSchema = z
  .string()
  .trim()
  .url()
  .max(2_048)
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Only HTTP(S) URLs are supported");
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const contentTypeSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[^\s/]+\/[A-Za-z0-9!#$&^_.+-]+$/);

export const publicationObjectManifestSchema = z.strictObject({
  kind: z.enum(["body_html", "body_markdown", "media", "asset", "raw_page"]),
  sha256: sha256Schema,
  size: z
    .number()
    .int()
    .nonnegative()
    .max(32 * 1024 * 1024),
  contentType: contentTypeSchema,
  sortOrder: z.number().int().nonnegative().max(10_000).optional(),
  altText: z.string().trim().max(1_000).optional(),
});

export const publicationSourceDescriptorSchema = z.strictObject({
  id: sourceIdSchema,
  name: z.string().trim().min(1).max(200),
  organizationLevel: z.string().trim().min(1).max(80).optional(),
  allowedHosts: z.array(z.string().trim().min(1).max(253)).max(100).optional(),
  blockedHosts: z.array(z.string().trim().min(1).max(253)).max(100).optional(),
  seedUrls: z.array(urlSchema).max(100).optional(),
  aliases: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
  discoveryOnly: z.boolean().optional(),
  maxImagesPerPage: z
    .number()
    .int()
    .positive()
    .max(1_000)
    .nullable()
    .optional(),
});

const publicationItemBaseSchema = {
  sourceId: sourceIdSchema,
  canonicalUrl: urlSchema,
  revisionHash: sha256Schema,
  observedAt: publicationDateTimeSchema,
};

const publicationItemSchema = z.union([
  z.strictObject({
    ...publicationItemBaseSchema,
    tombstone: z.literal(false).optional().default(false),
    publicationType: z.enum(["news", "notice", "other"]),
    title: z.string().trim().min(1).max(1_000),
    author: z.string().trim().max(500).nullable().optional(),
    publishedAt: publicationDateTimeSchema.nullable().optional(),
    updatedAtSource: publicationDateTimeSchema.nullable().optional(),
    category: z.string().trim().max(500).nullable().optional(),
    summary: z.string().trim().max(20_000).nullable().optional(),
    bodyText: z.string().max(5_000_000).nullable().optional(),
    sourcePageUrl: urlSchema.nullable().optional(),
    extractionMethod: z.string().trim().max(200).nullable().optional(),
    classifierVersion: z.string().trim().max(200).nullable().optional(),
    rawMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
    objects: z.array(publicationObjectManifestSchema).max(100).default([]),
  }),
  z.strictObject({
    ...publicationItemBaseSchema,
    tombstone: z.literal(true),
  }),
]);

export const publicationIngestionBatchRequestSchema = z.strictObject({
  protocolVersion: z.literal("1"),
  producerVersion: z.string().trim().min(1).max(200),
  clientRunId: z.string().trim().min(1).max(200),
  batchId: z.string().trim().min(1).max(200),
  observedAt: publicationDateTimeSchema,
  sources: z.array(publicationSourceDescriptorSchema).min(1).max(500),
  items: z.array(publicationItemSchema).min(1).max(500),
});

export const publicationObjectPlanRequestSchema = z.strictObject({
  batchId: z.string().trim().min(1).max(200),
  objects: z
    .array(
      z.strictObject({
        kind: publicationObjectManifestSchema.shape.kind,
        sha256: sha256Schema,
      }),
    )
    .min(1)
    .max(500),
});

export const publicationObjectCompleteRequestSchema = z.strictObject({
  batchId: z.string().trim().min(1).max(200),
  kind: publicationObjectManifestSchema.shape.kind,
  sha256: sha256Schema,
});

export type PublicationIngestionBatchRequest = z.output<
  typeof publicationIngestionBatchRequestSchema
>;
export type PublicationObjectManifest = z.output<
  typeof publicationObjectManifestSchema
>;
export type PublicationObjectPlanRequest = z.output<
  typeof publicationObjectPlanRequestSchema
>;
export type PublicationObjectCompleteRequest = z.output<
  typeof publicationObjectCompleteRequestSchema
>;
