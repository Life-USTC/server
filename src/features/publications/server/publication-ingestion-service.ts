import { parsePublicationDateInput } from "@/features/publications/lib/publication-date";
import { Prisma } from "@/generated/prisma/client";
import type {
  PublicationIngestionBatchRequest,
  PublicationObjectManifest,
} from "@/lib/api/schemas/request-publication-ingestion-schemas";
import {
  PUBLICATION_INGESTION_PRINCIPAL_KEY,
  type PublicationIngestionServicePrincipal,
} from "@/lib/auth/service-principal";
import { prisma } from "@/lib/db/prisma";

type TransactionClient = Prisma.TransactionClient;

/**
 * A full publication batch is allowed to contain 100 items. The associated
 * writes can take about 20 seconds in production, so allow enough time for
 * database contention while staying below the crawler's 60-second request
 * timeout.
 */
export const PUBLICATION_INGESTION_TRANSACTION_TIMEOUT_MS = 45_000;

export { PUBLICATION_INGESTION_BATCH_MAX_ITEMS } from "@/features/publications/lib/publication-ingestion-limits";

export class PublicationIngestionBadRequestError extends Error {
  readonly code = "publication_ingestion_bad_request";
}

export class PublicationIngestionConflictError extends Error {
  readonly code = "publication_ingestion_conflict";
}

export type PublicationIngestionItemResult = {
  canonicalUrl: string;
  revisionHash: string;
  sourceId: string;
  error?: string;
  publicationId: string | null;
  revisionId: string | null;
  status: "created" | "updated" | "unchanged" | "rejected";
};

export type PublicationIngestionBatchResult = {
  batchId: string;
  clientRunId: string;
  payloadDigest: string;
  results: PublicationIngestionItemResult[];
};

type RegisteredSource = {
  id: string;
  name: string;
  organizationLevel: string;
  allowedHosts: string[];
  blockedHosts: string[];
  seedUrls: string[];
  aliases: string[];
  discoveryOnly: boolean;
  maxImagesPerPage: number | null;
  allowAnyHost: boolean;
  enabled: boolean;
};

function parsePublicationDate(value: string | null | undefined) {
  const parsed = parsePublicationDateInput(value);
  if (!(parsed instanceof Date)) {
    throw new PublicationIngestionBadRequestError("Invalid publication date");
  }
  return parsed;
}

function parseOptionalPublicationDate(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  return parsePublicationDate(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
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

function revisionSemanticsMatch(
  revision: StoredPublicationRevision,
  item: PublicationIngestionItem,
) {
  return (
    JSON.stringify(canonicalize(revisionSemanticsFromStored(revision))) ===
    JSON.stringify(canonicalize(revisionSemanticsFromItem(item)))
  );
}

async function sha256Text(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function publicationIngestionPayloadDigest(
  payload: PublicationIngestionBatchRequest,
) {
  return sha256Text(JSON.stringify(canonicalize(payload)));
}

export function publicationPrincipalKey(
  _principal: PublicationIngestionServicePrincipal,
) {
  return PUBLICATION_INGESTION_PRINCIPAL_KEY;
}

function hostMatches(hostname: string, configuredHost: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const configured = configuredHost.toLowerCase().trim().replace(/\.$/, "");
  return host === configured || host.endsWith(`.${configured}`);
}

function sourceAllowsUrl(source: RegisteredSource, value: string) {
  const url = new URL(value);
  const blocked = (source.blockedHosts ?? []).some((host) =>
    hostMatches(url.hostname, host),
  );
  if (blocked) return false;
  // A source with no configured host restriction is allowed for a trusted
  // administrator descriptor. Existing persisted restrictions are reused when
  // a minimal descriptor is sent.
  if (source.allowAnyHost) return true;
  return source.allowedHosts.some((host) => hostMatches(url.hostname, host));
}

function validateSourceDescriptors(payload: PublicationIngestionBatchRequest) {
  const sources = new Map<
    string,
    PublicationIngestionBatchRequest["sources"][number]
  >();
  for (const source of payload.sources) {
    if (sources.has(source.id)) {
      throw new PublicationIngestionBadRequestError(
        `Duplicate publication source: ${source.id}`,
      );
    }
    sources.set(source.id, source);
  }
  return sources;
}

function jsonValue(value: Record<string, unknown> | null | undefined) {
  return value === null || value === undefined
    ? Prisma.JsonNull
    : (value as Prisma.InputJsonObject);
}

export function publicationObjectKey(
  kind: PublicationObjectManifest["kind"],
  sha256: string,
) {
  return `publications/${kind}/sha256/${sha256.slice(0, 2)}/${sha256}`;
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function maxDate(left: Date, right: Date) {
  return left.getTime() >= right.getTime() ? left : right;
}

async function ensureObjectManifest(
  tx: TransactionClient,
  batchId: string,
  manifest: PublicationObjectManifest,
) {
  const object = await tx.publicationObject.upsert({
    where: {
      kind_sha256: { kind: manifest.kind, sha256: manifest.sha256 },
    },
    create: {
      kind: manifest.kind,
      sha256: manifest.sha256,
      size: manifest.size,
      contentType: manifest.contentType,
      r2Key: publicationObjectKey(manifest.kind, manifest.sha256),
    },
    update: {},
  });

  if (
    object.r2Key !== publicationObjectKey(manifest.kind, manifest.sha256) ||
    object.size !== manifest.size
  ) {
    throw new PublicationIngestionBadRequestError(
      `Object manifest does not match ${manifest.kind}/${manifest.sha256}`,
    );
  }

  await tx.ingestionBatchObject.upsert({
    where: { batchId_objectId: { batchId, objectId: object.id } },
    create: {
      batchId,
      objectId: object.id,
      expectedSha256: manifest.sha256,
      expectedSize: manifest.size,
      expectedContentType: object.contentType,
    },
    update: {
      expectedSha256: manifest.sha256,
      expectedSize: manifest.size,
      expectedContentType: object.contentType,
    },
  });

  return object;
}

type PublicationIngestionItem =
  PublicationIngestionBatchRequest["items"][number];

function result(
  item: Pick<
    PublicationIngestionItem,
    "canonicalUrl" | "revisionHash" | "sourceId"
  >,
  status: PublicationIngestionItemResult["status"],
  publicationId: string | null,
  revisionId: string | null,
  error?: string,
): PublicationIngestionItemResult {
  return {
    canonicalUrl: item.canonicalUrl,
    revisionHash: item.revisionHash,
    sourceId: item.sourceId,
    status,
    publicationId,
    revisionId,
    ...(error ? { error } : {}),
  };
}

async function ingestItem(
  tx: TransactionClient,
  batchId: string,
  item: PublicationIngestionBatchRequest["items"][number],
  source: RegisteredSource,
): Promise<PublicationIngestionItemResult> {
  if (!sourceAllowsUrl(source, item.canonicalUrl)) {
    return result(
      item,
      "rejected",
      null,
      null,
      "canonicalUrl is outside the source allowed hosts",
    );
  }

  const observedAt = parsePublicationDate(item.observedAt);
  const publication = await tx.publication.findUnique({
    where: {
      sourceId_canonicalUrl: {
        sourceId: item.sourceId,
        canonicalUrl: item.canonicalUrl,
      },
    },
    include: {
      currentRevision: {
        select: {
          id: true,
          observedAt: true,
          revisionHash: true,
          isTombstone: true,
        },
      },
    },
  });

  if (item.tombstone && !publication) {
    return result(item, "unchanged", null, null);
  }

  const incomingHash = item.revisionHash;
  const currentRevision = publication?.currentRevision;
  if (
    currentRevision &&
    currentRevision.revisionHash === incomingHash &&
    currentRevision.isTombstone !== item.tombstone
  ) {
    throw new PublicationIngestionBadRequestError(
      "A revision hash cannot change between a publication and tombstone",
    );
  }
  const shouldApply =
    !currentRevision ||
    observedAt.getTime() > currentRevision.observedAt.getTime() ||
    (observedAt.getTime() === currentRevision.observedAt.getTime() &&
      incomingHash > currentRevision.revisionHash);

  if (!item.tombstone && !publication) {
    const created = await tx.publication.create({
      data: {
        sourceId: item.sourceId,
        canonicalUrl: item.canonicalUrl,
        title: item.title,
        author: item.author ?? null,
        publishedAt: parseOptionalPublicationDate(item.publishedAt),
        updatedAtSource: parseOptionalPublicationDate(item.updatedAtSource),
        category: item.category ?? null,
        summary: item.summary ?? null,
        bodyText: item.bodyText ?? null,
        sourcePageUrl: item.sourcePageUrl ?? null,
        extractionMethod: item.extractionMethod ?? null,
        rawMetadata: jsonValue(item.rawMetadata),
        publicationType: item.publicationType,
        classifierVersion: item.classifierVersion ?? null,
        firstSeenAt: observedAt,
        lastSeenAt: observedAt,
      },
    });
    const revision = await tx.publicationRevision.create({
      data: {
        publicationId: created.id,
        revisionHash: incomingHash,
        observedAt,
        title: item.title,
        author: item.author ?? null,
        publishedAt: parseOptionalPublicationDate(item.publishedAt),
        updatedAtSource: parseOptionalPublicationDate(item.updatedAtSource),
        category: item.category ?? null,
        summary: item.summary ?? null,
        bodyText: item.bodyText ?? null,
        sourcePageUrl: item.sourcePageUrl ?? null,
        extractionMethod: item.extractionMethod ?? null,
        rawMetadata: jsonValue(item.rawMetadata),
        publicationType: item.publicationType,
        classifierVersion: item.classifierVersion ?? null,
      },
    });
    await tx.publication.update({
      where: { id: created.id },
      data: { currentRevisionId: revision.id },
    });
    await linkObjects(tx, batchId, revision.id, item.objects);
    await writePublicationEvent(
      tx,
      batchId,
      created.id,
      revision.id,
      incomingHash,
    );
    return result(item, "created", created.id, revision.id);
  }

  if (!publication) {
    return result(item, "rejected", null, null, "invalid item");
  }

  const existingRevision = await tx.publicationRevision.findUnique({
    where: {
      publicationId_revisionHash: {
        publicationId: publication.id,
        revisionHash: incomingHash,
      },
    },
    include: {
      objectLinks: {
        include: {
          object: {
            select: { kind: true, sha256: true, size: true },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (existingRevision && !revisionSemanticsMatch(existingRevision, item)) {
    throw new PublicationIngestionBadRequestError(
      "A revision hash cannot change its stored publication semantics",
    );
  }

  if (!shouldApply) {
    return result(
      item,
      "unchanged",
      publication.id,
      currentRevision?.id ?? null,
    );
  }

  const revision =
    existingRevision ??
    (item.tombstone
      ? await tx.publicationRevision.create({
          data: {
            publicationId: publication.id,
            revisionHash: incomingHash,
            observedAt,
            isTombstone: true,
            publicationType: "other",
          },
        })
      : await tx.publicationRevision.create({
          data: {
            publicationId: publication.id,
            revisionHash: incomingHash,
            observedAt,
            title: item.title,
            author: item.author ?? null,
            publishedAt: parseOptionalPublicationDate(item.publishedAt),
            updatedAtSource: parseOptionalPublicationDate(item.updatedAtSource),
            category: item.category ?? null,
            summary: item.summary ?? null,
            bodyText: item.bodyText ?? null,
            sourcePageUrl: item.sourcePageUrl ?? null,
            extractionMethod: item.extractionMethod ?? null,
            rawMetadata: jsonValue(item.rawMetadata),
            publicationType: item.publicationType,
            classifierVersion: item.classifierVersion ?? null,
          },
        }));

  if (
    existingRevision &&
    existingRevision.observedAt.getTime() > observedAt.getTime()
  ) {
    return result(item, "unchanged", publication.id, existingRevision.id);
  }

  if (
    existingRevision &&
    observedAt.getTime() > existingRevision.observedAt.getTime()
  ) {
    await tx.publicationRevision.update({
      where: { id: existingRevision.id },
      data: { observedAt },
    });
  }

  if (item.tombstone) {
    await tx.publication.update({
      where: { id: publication.id },
      data: {
        currentRevisionId: revision.id,
        deletedAt: observedAt,
        lastSeenAt: maxDate(publication.lastSeenAt, observedAt),
      },
    });
  } else {
    await tx.publication.update({
      where: { id: publication.id },
      data: {
        title: item.title,
        author: item.author ?? null,
        publishedAt: parseOptionalPublicationDate(item.publishedAt),
        updatedAtSource: parseOptionalPublicationDate(item.updatedAtSource),
        category: item.category ?? null,
        summary: item.summary ?? null,
        bodyText: item.bodyText ?? null,
        sourcePageUrl: item.sourcePageUrl ?? null,
        extractionMethod: item.extractionMethod ?? null,
        rawMetadata: jsonValue(item.rawMetadata),
        publicationType: item.publicationType,
        classifierVersion: item.classifierVersion ?? null,
        currentRevisionId: revision.id,
        deletedAt: null,
        lastSeenAt: maxDate(publication.lastSeenAt, observedAt),
      },
    });
  }

  if (!item.tombstone)
    await linkObjects(tx, batchId, revision.id, item.objects);
  await writePublicationEvent(
    tx,
    batchId,
    publication.id,
    revision.id,
    incomingHash,
  );
  return result(item, "updated", publication.id, revision.id);
}

async function linkObjects(
  tx: TransactionClient,
  batchId: string,
  revisionId: string,
  manifests: PublicationObjectManifest[],
) {
  const seen = new Set<string>();
  for (const manifest of manifests) {
    const key = `${manifest.kind}:${manifest.sha256}`;
    if (seen.has(key)) {
      throw new PublicationIngestionBadRequestError(
        `Duplicate object manifest: ${key}`,
      );
    }
    seen.add(key);
    const object = await ensureObjectManifest(tx, batchId, manifest);
    await tx.publicationObjectLink.upsert({
      where: {
        revisionId_objectId_role: {
          revisionId,
          objectId: object.id,
          role: manifest.kind,
        },
      },
      create: {
        revisionId,
        objectId: object.id,
        role: manifest.kind,
        sortOrder: manifest.sortOrder ?? null,
        altText: manifest.altText ?? null,
      },
      update: {
        sortOrder: manifest.sortOrder ?? null,
        altText: manifest.altText ?? null,
      },
    });
  }
}

async function writePublicationEvent(
  tx: TransactionClient,
  batchId: string,
  publicationId: string,
  revisionId: string,
  revisionHash: string,
) {
  const eventId = `publication.revision:${publicationId}:${revisionHash}`;
  await tx.publicationEventOutbox.upsert({
    where: { eventId },
    create: {
      eventId,
      eventType: "publication.revision.accepted",
      aggregateType: "publication",
      aggregateId: publicationId,
      payload: {
        batchId,
        publicationId,
        revisionId,
        revisionHash,
      },
    },
    update: {},
  });
}

function storedResult(
  value: Prisma.JsonValue | null,
): PublicationIngestionBatchResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stored ingestion result is invalid");
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.batchId !== "string" ||
    typeof record.clientRunId !== "string" ||
    typeof record.payloadDigest !== "string" ||
    !Array.isArray(record.results)
  ) {
    throw new Error("Stored ingestion result is invalid");
  }
  return record as unknown as PublicationIngestionBatchResult;
}

async function ingestWithRetry(
  _principal: PublicationIngestionServicePrincipal,
  payload: PublicationIngestionBatchRequest,
  payloadDigest: string,
  principalKey: string,
) {
  const response = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.ingestionBatch.findUnique({
        where: {
          principalKey_batchId: { principalKey, batchId: payload.batchId },
        },
      });
      if (existing) {
        if (existing.payloadDigest !== payloadDigest) {
          throw new PublicationIngestionConflictError(
            "The batch ID was already used with a different payload",
          );
        }
        return storedResult(existing.result);
      }

      validateSourceDescriptors(payload);
      const run = await tx.ingestionRun.upsert({
        where: {
          principalKey_clientRunId: {
            principalKey,
            clientRunId: payload.clientRunId,
          },
        },
        create: {
          clientRunId: payload.clientRunId,
          principalKey,
          observedAt: parsePublicationDate(payload.observedAt),
        },
        update: {
          observedAt: parsePublicationDate(payload.observedAt),
          status: "running",
        },
      });

      const registeredSources = new Map<string, RegisteredSource>();
      for (const source of payload.sources) {
        const registered = await tx.publicationSource.upsert({
          where: { id: source.id },
          create: {
            id: source.id,
            name: source.name,
            organizationLevel: source.organizationLevel ?? "unknown",
            allowedHosts: source.allowedHosts ?? [],
            blockedHosts: source.blockedHosts ?? [],
            seedUrls: source.seedUrls ?? [],
            aliases: source.aliases ?? [],
            discoveryOnly: source.discoveryOnly ?? false,
            maxImagesPerPage: source.maxImagesPerPage ?? null,
          },
          update: {
            name: source.name,
            ...(source.organizationLevel === undefined
              ? {}
              : { organizationLevel: source.organizationLevel }),
            ...(source.allowedHosts === undefined
              ? {}
              : { allowedHosts: source.allowedHosts }),
            ...(source.blockedHosts === undefined
              ? {}
              : { blockedHosts: source.blockedHosts }),
            ...(source.seedUrls === undefined
              ? {}
              : { seedUrls: source.seedUrls }),
            ...(source.aliases === undefined
              ? {}
              : { aliases: source.aliases }),
            ...(source.discoveryOnly === undefined
              ? {}
              : { discoveryOnly: source.discoveryOnly }),
            ...(source.maxImagesPerPage === undefined
              ? {}
              : { maxImagesPerPage: source.maxImagesPerPage }),
          },
        });
        registeredSources.set(source.id, {
          id: registered.id,
          name: registered.name,
          organizationLevel: registered.organizationLevel,
          allowedHosts: source.allowedHosts ?? registered.allowedHosts,
          blockedHosts: source.blockedHosts ?? registered.blockedHosts,
          seedUrls: source.seedUrls ?? registered.seedUrls,
          aliases: source.aliases ?? registered.aliases,
          discoveryOnly: source.discoveryOnly ?? registered.discoveryOnly,
          maxImagesPerPage:
            source.maxImagesPerPage === undefined
              ? registered.maxImagesPerPage
              : source.maxImagesPerPage,
          enabled: registered.enabled,
          allowAnyHost:
            (source.allowedHosts ?? registered.allowedHosts).length === 0,
        });
      }

      const batch = await tx.ingestionBatch.create({
        data: {
          batchId: payload.batchId,
          runId: run.id,
          principalKey,
          payloadDigest,
          itemCount: payload.items.length,
        },
      });

      const results: PublicationIngestionItemResult[] = [];
      for (const item of payload.items) {
        const source = registeredSources.get(item.sourceId);
        if (!source?.enabled || source.discoveryOnly) {
          results.push(
            result(
              item,
              "rejected",
              null,
              null,
              source && !source.enabled
                ? "source is disabled"
                : source
                  ? "discovery-only source cannot ingest publications"
                  : "source is not registered in this batch",
            ),
          );
          continue;
        }
        results.push(await ingestItem(tx, batch.id, item, source));
      }

      const response: PublicationIngestionBatchResult = {
        batchId: payload.batchId,
        clientRunId: payload.clientRunId,
        payloadDigest,
        results,
      };
      await tx.ingestionBatch.update({
        where: { id: batch.id },
        data: { result: response as unknown as Prisma.InputJsonObject },
      });
      await tx.ingestionRun.update({
        where: { id: run.id },
        data: { status: "completed" },
      });
      return response;
    },
    { timeout: PUBLICATION_INGESTION_TRANSACTION_TIMEOUT_MS },
  );

  return response;
}

export async function ingestPublicationBatch(input: {
  payload: PublicationIngestionBatchRequest;
  principal: PublicationIngestionServicePrincipal;
}) {
  const { payload, principal } = input;
  const principalKey = publicationPrincipalKey(principal);
  const payloadDigest = await publicationIngestionPayloadDigest(payload);
  try {
    return await ingestWithRetry(
      principal,
      payload,
      payloadDigest,
      principalKey,
    );
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await prisma.ingestionBatch.findUnique({
      where: {
        principalKey_batchId: { principalKey, batchId: payload.batchId },
      },
    });
    if (!existing) throw error;
    if (existing.payloadDigest !== payloadDigest) {
      throw new PublicationIngestionConflictError(
        "The batch ID was already used with a different payload",
      );
    }
    return storedResult(existing.result);
  }
}
