import * as z from "zod";
import {
  PUBLICATION_SOURCE_ORGANIZATION_LEVELS,
  publicationSourceOrganizationLevelSchema,
} from "@/features/publications/lib/publication-source-levels";
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

/**
 * The source stamp carried by every list and detail row.
 *
 * `organizationLevel` stays a plain string here even though the column is now
 * a closed enum (issue #1069). This field shipped as an open string, and
 * narrowing a response property to an enum hands generated clients an
 * exhaustive type that a later registry level would break. The new
 * /api/publications/sources directory, which has no such history, documents
 * the vocabulary instead.
 */
export const publicPublicationSourceSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  organizationLevel: z.string().meta({
    description: `Source organization level. Currently one of: ${PUBLICATION_SOURCE_ORGANIZATION_LEVELS.join(", ")}. Treat an unrecognized value as unknown rather than an error.`,
  }),
});

/**
 * One registered source in the public directory (issue #1069). `hosts` is the
 * source's allowed-host list; `publicationCount` and `lastPublishedAt` are
 * computed over the same visibility filter the list read uses, so they always
 * agree with /api/publications?source=<id>.
 */
export const publicPublicationSourceSummarySchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  organizationLevel: publicationSourceOrganizationLevelSchema,
  hosts: z.array(z.string()),
  publicationCount: z.number().int().nonnegative(),
  lastPublishedAt: dateTimeSchema.nullable(),
});

export const publicPublicationSourceGroupSchema = z.strictObject({
  organizationLevel: publicationSourceOrganizationLevelSchema,
  sourceCount: z.number().int().nonnegative(),
  publicationCount: z.number().int().nonnegative(),
  sources: z.array(publicPublicationSourceSummarySchema),
});

/**
 * The directory is a bounded registry (~80 sources), so it is returned whole
 * rather than paginated; groups are ordered by organization level and omit a
 * level with no registered source.
 */
export const publicPublicationSourceDirectoryResponseSchema = z.strictObject({
  groups: z.array(publicPublicationSourceGroupSchema),
  totals: z.strictObject({
    sourceCount: z.number().int().nonnegative(),
    publicationCount: z.number().int().nonnegative(),
  }),
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
  filename: z.string().nullable(),
  sourceUrl: z.string().url().nullable(),
});

const publicPublicationRevisionBaseSchema = {
  id: z.string(),
  revisionHash: z.string().regex(/^[a-f0-9]{64}$/),
  observedAt: dateTimeSchema,
  title: z.string(),
  author: z.string().nullable(),
  reporter: z.string().nullable(),
  editor: z.string().nullable(),
  originalPublisher: z.string().nullable(),
  publishedAt: dateTimeSchema.nullable(),
  updatedAtSource: dateTimeSchema.nullable(),
  category: z.string().nullable(),
  summary: z.string().nullable(),
  sourcePageUrl: z.string().url().nullable(),
};

export const publicPublicationRevisionSummarySchema = z.strictObject({
  ...publicPublicationRevisionBaseSchema,
});

/**
 * Present only on a `fold=1` list response, and only for a row that
 * represents 2+ folded reprints (see issue #1068). Absent otherwise, so the
 * default (unfolded) response shape is unchanged.
 */
export const publicPublicationFoldSummarySchema = z.strictObject({
  siblingCount: z.number().int().positive(),
});

export const publicPublicationListItemSchema = z.strictObject({
  id: z.string(),
  canonicalUrl: z.string().url(),
  publicationType: publicationTypeSchema,
  source: publicPublicationSourceSchema,
  revision: publicPublicationRevisionSummarySchema,
  objects: z.array(publicPublicationObjectSchema),
  foldGroup: publicPublicationFoldSummarySchema.optional(),
});

export const publicPublicationSiblingSchema = z.strictObject({
  id: z.string(),
  canonicalUrl: z.string().url(),
  source: publicPublicationSourceSchema,
  publishedAt: dateTimeSchema.nullable(),
});

export const publicPublicationRevisionDetailSchema = z.strictObject({
  ...publicPublicationRevisionBaseSchema,
  images: z.array(
    z.strictObject({
      id: z.string(),
      url: z.string().startsWith("/api/publications/images/"),
      altText: z.string().nullable(),
      title: z.string().nullable(),
      caption: z.string().nullable(),
    }),
  ),
  bodyText: z.string().nullable(),
  bodyMarkdown: z.string().nullable(),
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
  alsoPublishedIn: z.array(publicPublicationSiblingSchema),
});

export const publicPublicationsResponseSchema = createPaginatedSchema(
  publicPublicationListItemSchema,
);

/** The object route streams bytes; this schema documents its binary response. */
export const publicPublicationObjectBinaryResponseSchema = z.string();
