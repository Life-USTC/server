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

type PublicationRevisionSemanticObject = {
  // MIME aliases do not change the content-addressed object represented by a
  // revision. The stored PublicationObject contentType remains authoritative
  // for upload and public-read metadata.
  altText: string | null;
  kind: string;
  sha256: string;
  size: number;
  sortOrder: number | null;
};

type PublicationRevisionSemantics = {
  author: string | null;
  bodyText: string | null;
  category: string | null;
  classifierVersion: string | null;
  extractionMethod: string | null;
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
      bodyText: null,
      category: null,
      classifierVersion: null,
      extractionMethod: null,
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
    bodyText: item.bodyText ?? null,
    category: item.category ?? null,
    classifierVersion: item.classifierVersion ?? null,
    extractionMethod: item.extractionMethod ?? null,
    isTombstone: false,
    objects: sortRevisionSemanticObjects(
      item.objects.map((object) => ({
        altText: object.altText ?? null,
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
  bodyText: string | null;
  category: string | null;
  classifierVersion: string | null;
  extractionMethod: string | null;
  isTombstone: boolean;
  objectLinks?: Array<{
    altText: string | null;
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
    bodyText: revision.bodyText,
    category: revision.category,
    classifierVersion: revision.classifierVersion,
    extractionMethod: revision.extractionMethod,
    isTombstone: revision.isTombstone,
    objects: sortRevisionSemanticObjects(
      (revision.objectLinks ?? []).map((link) => ({
        altText: link.altText,
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
