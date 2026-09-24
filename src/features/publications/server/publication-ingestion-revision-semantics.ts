import { parsePublicationDateInput } from "@/features/publications/lib/publication-date";
import { Prisma } from "@/generated/prisma/client";
import type { PublicationIngestionBatchRequest } from "@/lib/api/schemas/request-publication-ingestion-schemas";
import { PublicationIngestionBadRequestError } from "./publication-ingestion-errors";
import { canonicalize } from "./publication-ingestion-keys";

export function parsePublicationDate(value: string | null | undefined) {
  const parsed = parsePublicationDateInput(value);
  if (!(parsed instanceof Date)) {
    throw new PublicationIngestionBadRequestError("Invalid publication date");
  }
  return parsed;
}

export function parseOptionalPublicationDate(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  return parsePublicationDate(value);
}

function normalizeStoredJson(value: unknown) {
  return value === null ||
    value === undefined ||
    value === Prisma.JsonNull ||
    value === Prisma.DbNull
    ? null
    : value;
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/** Validate the crawler's URL-hash mapping before it becomes public routing
 * metadata. The hash covers the exact URL string as UTF-8. */
export async function validatePublicationImageSources(
  imageSources: Record<string, string>,
) {
  for (const [hash, value] of Object.entries(imageSources)) {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    );
    if (toHex(new Uint8Array(digest)) !== hash) {
      throw new PublicationIngestionBadRequestError(
        `Image source key does not match its URL: ${hash}`,
      );
    }
  }
}

function normalizeImageMetadata(
  values: Record<
    string,
    { altText?: string | null; title?: string | null; caption?: string | null }
  >,
) {
  return Object.fromEntries(
    Object.entries(values).flatMap(([hash, value]) => {
      const metadata = {
        altText: value.altText ?? null,
        title: value.title ?? null,
        caption: value.caption ?? null,
      };
      return Object.values(metadata).some((part) => part != null)
        ? [[hash, metadata]]
        : [];
    }),
  );
}

type PublicationRevisionSemanticObject = {
  // MIME aliases do not change the content-addressed object represented by a
  // revision. The stored PublicationObject contentType remains authoritative
  // for upload and public-read metadata.
  altText: string | null;
  filename?: string | null;
  sourceUrl?: string | null;
  kind: string;
  sha256: string;
  size: number;
  sortOrder: number | null;
};

type PublicationRevisionSemantics = {
  author: string | null;
  reporter?: string | null;
  editor?: string | null;
  originalPublisher?: string | null;
  bodyText: string | null;
  category: string | null;
  classifierVersion: string | null;
  extractionMethod: string | null;
  imageSources: Record<string, string>;
  imageMetadata: Record<
    string,
    { altText: string | null; title: string | null; caption: string | null }
  >;
  isTombstone: boolean;
  objects: PublicationRevisionSemanticObject[];
  publishedAt: string | null;
  publicationType: string;
  rawMetadata: unknown;
  sourcePageUrl: string | null;
  summary: string | null;
  title: string | null;
  updatedAtSource: string | null;
};

function revisionSemanticObjectKey(object: PublicationRevisionSemanticObject) {
  return JSON.stringify(canonicalize(object));
}

function sortRevisionSemanticObjects(
  objects: PublicationRevisionSemanticObject[],
) {
  return [...objects].sort((left, right) => {
    const leftKey = revisionSemanticObjectKey(left);
    const rightKey = revisionSemanticObjectKey(right);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

type PublicationIngestionItem =
  PublicationIngestionBatchRequest["items"][number];

function revisionSemanticsFromItem(
  item: PublicationIngestionItem,
): PublicationRevisionSemantics {
  if (item.tombstone) {
    return {
      author: null,
      reporter: null,
      editor: null,
      originalPublisher: null,
      bodyText: null,
      category: null,
      classifierVersion: null,
      extractionMethod: null,
      imageSources: {},
      imageMetadata: {},
      isTombstone: true,
      objects: [],
      publishedAt: null,
      publicationType: "other",
      rawMetadata: null,
      sourcePageUrl: null,
      summary: null,
      title: null,
      updatedAtSource: null,
    };
  }

  return {
    author: item.author ?? null,
    reporter: item.reporter ?? null,
    editor: item.editor ?? null,
    originalPublisher: item.originalPublisher ?? null,
    bodyText: item.bodyText ?? null,
    category: item.category ?? null,
    classifierVersion: item.classifierVersion ?? null,
    extractionMethod: item.extractionMethod ?? null,
    imageSources: item.imageSources,
    imageMetadata: normalizeImageMetadata(item.imageMetadata ?? {}),
    isTombstone: false,
    objects: sortRevisionSemanticObjects(
      item.objects.map((object) => ({
        altText: object.altText ?? null,
        filename: object.filename ?? null,
        sourceUrl: object.sourceUrl ?? null,
        kind: object.kind,
        sha256: object.sha256,
        size: object.size,
        sortOrder: object.sortOrder ?? null,
      })),
    ),
    publishedAt:
      parseOptionalPublicationDate(item.publishedAt)?.toISOString() ?? null,
    publicationType: item.publicationType,
    rawMetadata: normalizeStoredJson(item.rawMetadata),
    sourcePageUrl: item.sourcePageUrl ?? null,
    summary: item.summary ?? null,
    title: item.title,
    updatedAtSource:
      parseOptionalPublicationDate(item.updatedAtSource)?.toISOString() ?? null,
  };
}

type StoredPublicationRevision = {
  author: string | null;
  reporter?: string | null;
  editor?: string | null;
  originalPublisher?: string | null;
  bodyText: string | null;
  category: string | null;
  classifierVersion: string | null;
  extractionMethod: string | null;
  imageSourceRefs?: Array<{
    imageSource: { id: string; url: string } | null;
    altText?: string | null;
    title?: string | null;
    caption?: string | null;
  }>;
  isTombstone: boolean;
  objectLinks?: Array<{
    altText: string | null;
    filename?: string | null;
    sourceUrl?: string | null;
    object: {
      kind: string;
      sha256: string;
      size: number;
    } | null;
    role: string;
    sortOrder: number | null;
  }>;
  publishedAt: Date | null;
  publicationType: string;
  rawMetadata: unknown;
  sourcePageUrl: string | null;
  summary: string | null;
  title: string | null;
  updatedAtSource: Date | null;
};

function revisionSemanticsFromStored(
  revision: StoredPublicationRevision,
): PublicationRevisionSemantics {
  return {
    author: revision.author,
    reporter: revision.reporter ?? null,
    editor: revision.editor ?? null,
    originalPublisher: revision.originalPublisher ?? null,
    bodyText: revision.bodyText,
    category: revision.category,
    classifierVersion: revision.classifierVersion,
    extractionMethod: revision.extractionMethod,
    imageSources:
      revision.imageSourceRefs?.reduce<Record<string, string>>(
        (sources, reference) => {
          if (reference.imageSource) {
            sources[reference.imageSource.id] = reference.imageSource.url;
          }
          return sources;
        },
        {},
      ) ?? {},
    imageMetadata: normalizeImageMetadata(
      Object.fromEntries(
        (revision.imageSourceRefs ?? []).flatMap((ref) =>
          ref.imageSource ? [[ref.imageSource.id, ref]] : [],
        ),
      ),
    ),
    isTombstone: revision.isTombstone,
    objects: sortRevisionSemanticObjects(
      (revision.objectLinks ?? []).map((link) => ({
        altText: link.altText,
        filename: link.filename ?? null,
        sourceUrl: link.sourceUrl ?? null,
        kind: link.role,
        sha256: link.object?.sha256 ?? "",
        size: link.object?.size ?? -1,
        sortOrder: link.sortOrder,
      })),
    ),
    publishedAt: revision.publishedAt?.toISOString() ?? null,
    publicationType: revision.publicationType,
    rawMetadata: normalizeStoredJson(revision.rawMetadata),
    sourcePageUrl: revision.sourcePageUrl,
    summary: revision.summary,
    title: revision.title,
    updatedAtSource: revision.updatedAtSource?.toISOString() ?? null,
  };
}

export function revisionSemanticsMatch(
  revision: StoredPublicationRevision,
  item: PublicationIngestionItem,
) {
  return (
    JSON.stringify(canonicalize(revisionSemanticsFromStored(revision))) ===
    JSON.stringify(canonicalize(revisionSemanticsFromItem(item)))
  );
}
