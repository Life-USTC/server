import type { PublicationSourceOrganizationLevel } from "@/features/publications/lib/publication-source-levels";
import { Prisma } from "@/generated/prisma/client";
import type {
  PublicationIngestionBatchRequest,
  PublicationObjectManifest,
} from "@/lib/api/schemas/request-publication-ingestion-schemas";
import { logAppEvent } from "@/lib/log/app-logger";
import {
  PublicationIngestionBadRequestError,
  type PublicationIngestionItemResult,
} from "./publication-ingestion-errors";
import { publicationObjectKey } from "./publication-ingestion-keys";
import {
  parseOptionalPublicationDate,
  parsePublicationDate,
  revisionSemanticsMatch,
  validatePublicationImageSources,
} from "./publication-ingestion-revision-semantics";

type TransactionClient = Prisma.TransactionClient;

export type RegisteredSource = {
  id: string;
  name: string;
  organizationLevel: PublicationSourceOrganizationLevel;
  allowedHosts: string[];
  blockedHosts: string[];
  seedUrls: string[];
  aliases: string[];
  discoveryOnly: boolean;
  maxImagesPerPage: number | null;
  allowAnyHost: boolean;
  enabled: boolean;
};

type PublicationIngestionItem =
  PublicationIngestionBatchRequest["items"][number];

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

export function validateSourceDescriptors(
  payload: PublicationIngestionBatchRequest,
) {
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

function maxDate(left: Date, right: Date) {
  return left.getTime() >= right.getTime() ? left : right;
}

async function ensureObjectManifest(
  tx: TransactionClient,
  batchId: string,
  manifest: PublicationObjectManifest,
) {
  let object = await tx.publicationObject.upsert({
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

  // A stored key that no longer matches the content address means the key
  // derivation changed; never repair that silently.
  if (object.r2Key !== publicationObjectKey(manifest.kind, manifest.sha256)) {
    throw new PublicationIngestionBadRequestError(
      `Object manifest does not match ${manifest.kind}/${manifest.sha256}`,
    );
  }

  if (object.size !== manifest.size) {
    // sha256 is byte identity, so a stored size that disagrees with a manifest
    // carrying the same sha256 is corrupt metadata (e.g. drift between crawler
    // forks). It is only safe to repair while no bytes were ever verified
    // against the row; once bytes verify they are the ground truth and a
    // conflicting manifest must be rejected.
    if (
      object.verifiedAt !== null ||
      (object.status !== "pending" && object.status !== "failed")
    ) {
      throw new PublicationIngestionBadRequestError(
        `Object manifest does not match ${manifest.kind}/${manifest.sha256}`,
      );
    }
    logAppEvent("warn", "Self-healing stale publication object manifest", {
      source: "publications",
      kind: manifest.kind,
      sha256: manifest.sha256,
      previousSize: object.size,
      size: manifest.size,
      previousContentType: object.contentType,
      contentType: manifest.contentType,
    });
    object = await tx.publicationObject.update({
      where: { id: object.id },
      data: { size: manifest.size, contentType: manifest.contentType },
    });
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

async function linkImageSources(
  tx: TransactionClient,
  revisionId: string,
  imageSources: Record<string, string>,
  imageMetadata: Record<
    string,
    { altText?: string | null; title?: string | null; caption?: string | null }
  > = {},
) {
  for (const [id, url] of Object.entries(imageSources)) {
    const source = await tx.publicationImageSource.upsert({
      where: { id },
      create: { id, url },
      update: {},
    });
    if (source.url !== url) {
      throw new PublicationIngestionBadRequestError(
        `Image source ${id} does not match its stored URL`,
      );
    }
    await tx.publicationRevisionImageSource.upsert({
      where: {
        revisionId_imageSourceId: {
          revisionId,
          imageSourceId: id,
        },
      },
      create: {
        revisionId,
        imageSourceId: id,
        altText: imageMetadata[id]?.altText ?? null,
        title: imageMetadata[id]?.title ?? null,
        caption: imageMetadata[id]?.caption ?? null,
      },
      update: {},
    });
  }
}

export function result(
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

export async function ingestItem(
  tx: TransactionClient,
  batchId: string,
  item: PublicationIngestionBatchRequest["items"][number],
  source: RegisteredSource,
): Promise<PublicationIngestionItemResult> {
  if (!item.tombstone) {
    await validatePublicationImageSources(item.imageSources);
  }
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
        publishedAt: parseOptionalPublicationDate(item.publishedAt),
        summary: item.summary ?? null,
        publicationType: item.publicationType,
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
        reporter: item.reporter ?? null,
        editor: item.editor ?? null,
        originalPublisher: item.originalPublisher ?? null,
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
    await linkImageSources(
      tx,
      revision.id,
      item.imageSources,
      item.imageMetadata,
    );
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
      imageSourceRefs: {
        include: {
          imageSource: {
            select: { id: true, url: true },
          },
        },
      },
    },
  });
  if (existingRevision && !revisionSemanticsMatch(existingRevision, item)) {
    throw new PublicationIngestionBadRequestError(
      "A revision hash cannot change its stored publication semantics",
    );
  }

  if (!shouldApply) {
    const unchanged = result(
      item,
      "unchanged",
      publication.id,
      currentRevision?.id ?? null,
    );
    // A redelivery with a new batchId re-registers the item's object claims
    // so the object plan endpoint accepts this batch, and surfaces claims
    // whose bytes were never uploaded (e.g. an earlier batch crashed between
    // claiming and uploading).
    if (!item.tombstone && existingRevision) {
      const linked = await linkObjects(
        tx,
        batchId,
        existingRevision.id,
        item.objects,
      );
      await linkImageSources(
        tx,
        existingRevision.id,
        item.imageSources,
        item.imageMetadata,
      );
      const missing = objectsNeedingUpload(linked);
      if (missing.length > 0) unchanged.objectsNeedingUpload = missing;
    }
    return unchanged;
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
            reporter: item.reporter ?? null,
            editor: item.editor ?? null,
            originalPublisher: item.originalPublisher ?? null,
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
    const unchanged = result(
      item,
      "unchanged",
      publication.id,
      existingRevision.id,
    );
    if (!item.tombstone) {
      const linked = await linkObjects(
        tx,
        batchId,
        existingRevision.id,
        item.objects,
      );
      await linkImageSources(
        tx,
        existingRevision.id,
        item.imageSources,
        item.imageMetadata,
      );
      const missing = objectsNeedingUpload(linked);
      if (missing.length > 0) unchanged.objectsNeedingUpload = missing;
    }
    return unchanged;
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
        publishedAt: parseOptionalPublicationDate(item.publishedAt),
        summary: item.summary ?? null,
        publicationType: item.publicationType,
        currentRevisionId: revision.id,
        deletedAt: null,
        lastSeenAt: maxDate(publication.lastSeenAt, observedAt),
      },
    });
  }

  if (!item.tombstone)
    await linkObjects(tx, batchId, revision.id, item.objects);
  if (!item.tombstone)
    await linkImageSources(
      tx,
      revision.id,
      item.imageSources,
      item.imageMetadata,
    );
  await writePublicationEvent(
    tx,
    batchId,
    publication.id,
    revision.id,
    incomingHash,
  );
  return result(item, "updated", publication.id, revision.id);
}

type LinkedObject = {
  kind: PublicationObjectManifest["kind"];
  sha256: string;
  status: string;
};

function objectsNeedingUpload(linked: LinkedObject[]) {
  // "linked" and "verified" are the only states reached after strict byte
  // verification, matching the trust model of the object plan endpoint.
  return linked
    .filter(
      (object) => object.status !== "linked" && object.status !== "verified",
    )
    .map(({ kind, sha256 }) => ({ kind, sha256 }));
}

async function linkObjects(
  tx: TransactionClient,
  batchId: string,
  revisionId: string,
  manifests: PublicationObjectManifest[],
): Promise<LinkedObject[]> {
  const seen = new Set<string>();
  const linked: LinkedObject[] = [];
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
        filename: manifest.filename ?? null,
        sourceUrl: manifest.sourceUrl ?? null,
      },
      update: {
        sortOrder: manifest.sortOrder ?? null,
        altText: manifest.altText ?? null,
        filename: manifest.filename ?? null,
        sourceUrl: manifest.sourceUrl ?? null,
      },
    });
    linked.push({
      kind: manifest.kind,
      sha256: manifest.sha256,
      status: object.status,
    });
  }
  return linked;
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
