import * as z from "zod";
import {
  createPaginatedSchema,
  dateTimeSchema,
} from "./response-schema-primitives";

const publicationTypeSchema = z.enum(["news", "notice"]);
const publicationObjectKindSchema = z.enum([
  "body_html",
  "body_markdown",
  "media",
  "asset",
  "raw_page",
]);

export const publicPublicationSourceSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  organizationLevel: z.string(),
});

export const publicPublicationObjectSchema = z.strictObject({
  kind: publicationObjectKindSchema,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  size: z.number().int().nonnegative(),
  contentType: z.string(),
  status: z.enum(["verified", "linked"]),
  url: z.string().startsWith("/api/publications/objects/"),
  sortOrder: z.number().int().nonnegative().nullable(),
  altText: z.string().nullable(),
});

const publicPublicationRevisionBaseSchema = {
  id: z.string(),
  revisionHash: z.string().regex(/^[a-f0-9]{64}$/),
  observedAt: dateTimeSchema,
  title: z.string(),
  author: z.string().nullable(),
  publishedAt: dateTimeSchema.nullable(),
  updatedAtSource: dateTimeSchema.nullable(),
  category: z.string().nullable(),
  summary: z.string().nullable(),
  sourcePageUrl: z.string().url().nullable(),
};

export const publicPublicationRevisionSummarySchema = z.strictObject({
  ...publicPublicationRevisionBaseSchema,
});

export const publicPublicationListItemSchema = z.strictObject({
  id: z.string(),
  canonicalUrl: z.string().url(),
  publicationType: publicationTypeSchema,
  source: publicPublicationSourceSchema,
  revision: publicPublicationRevisionSummarySchema,
  objects: z.array(publicPublicationObjectSchema),
});

export const publicPublicationRevisionDetailSchema = z.strictObject({
  ...publicPublicationRevisionBaseSchema,
  bodyText: z.string().nullable(),
  extractionMethod: z.string().nullable(),
  classifierVersion: z.string().nullable(),
  objects: z.array(publicPublicationObjectSchema),
});

export const publicPublicationDetailSchema = z.strictObject({
  id: z.string(),
  canonicalUrl: z.string().url(),
  publicationType: publicationTypeSchema,
  source: publicPublicationSourceSchema,
  revision: publicPublicationRevisionDetailSchema,
});

export const publicPublicationsResponseSchema = createPaginatedSchema(
  publicPublicationListItemSchema,
);

/** The object route streams bytes; this schema documents its binary response. */
export const publicPublicationObjectBinaryResponseSchema = z.string();
