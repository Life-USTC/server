import type { PublicationSourceOrganizationLevel } from "@/features/publications/lib/publication-source-levels";
import { Prisma } from "@/generated/prisma/client";
import type { PublicationIngestionBatchRequest } from "@/lib/api/schemas/request-publication-ingestion-schemas";
import {
  PublicationIngestionBadRequestError,
  type PublicationIngestionItemResult,
} from "./publication-ingestion-errors";
import type { PendingPublicationLinks } from "./publication-ingestion-links";
import {
  incomingRevisionSemanticsKey,
  parseOptionalPublicationDate,
  parsePublicationDate,
  validatePublicationImageSources,
} from "./publication-ingestion-revision-semantics";
import {
  type IngestionBatchState,
  publicationIdentity,
  rememberRevision,
  revisionIdentity,
} from "./publication-ingestion-state";

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
  state: IngestionBatchState,
  links: PendingPublicationLinks[],
  events: Prisma.PublicationEventOutboxCreateManyInput[],
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
  const publication = state.publications.get(publicationIdentity(item));

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
      select: { id: true },
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
      select: { id: true },
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
      select: { id: true },
      where: { id: created.id },
      data: { currentRevisionId: revision.id },
    });
    const remembered = rememberRevision(
      state,
      created.id,
      revision.id,
      item,
      observedAt,
    );
    state.publications.set(publicationIdentity(item), {
      id: created.id,
      lastSeenAt: observedAt,
      currentRevision: remembered,
    });
    links.push({ revisionId: revision.id, item });
    writePublicationEvent(
      events,
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

  const existingRevision = state.revisions.get(
    revisionIdentity(publication.id, incomingHash),
  );
  if (
    existingRevision &&
    existingRevision.semantics !== incomingRevisionSemanticsKey(item)
  ) {
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
      links.push({ revisionId: existingRevision.id, item, unchanged });
    }
    return unchanged;
  }

  const revision =
    existingRevision ??
    (item.tombstone
      ? await tx.publicationRevision.create({
          select: { id: true },
          data: {
            publicationId: publication.id,
            revisionHash: incomingHash,
            observedAt,
            isTombstone: true,
            publicationType: "other",
          },
        })
      : await tx.publicationRevision.create({
          select: { id: true },
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

  const remembered =
    existingRevision ??
    rememberRevision(state, publication.id, revision.id, item, observedAt);

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
      links.push({ revisionId: existingRevision.id, item, unchanged });
    }
    return unchanged;
  }

  if (
    existingRevision &&
    observedAt.getTime() > existingRevision.observedAt.getTime()
  ) {
    await tx.publicationRevision.update({
      select: { id: true },
      where: { id: existingRevision.id },
      data: { observedAt },
    });
    existingRevision.observedAt = observedAt;
  }

  if (item.tombstone) {
    await tx.publication.update({
      select: { id: true },
      where: { id: publication.id },
      data: {
        currentRevisionId: revision.id,
        deletedAt: observedAt,
        lastSeenAt: maxDate(publication.lastSeenAt, observedAt),
      },
    });
  } else {
    await tx.publication.update({
      select: { id: true },
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

  publication.currentRevision = remembered;
  publication.lastSeenAt = maxDate(publication.lastSeenAt, observedAt);
  if (!item.tombstone) links.push({ revisionId: revision.id, item });
  writePublicationEvent(
    events,
    batchId,
    publication.id,
    revision.id,
    incomingHash,
  );
  return result(item, "updated", publication.id, revision.id);
}

function writePublicationEvent(
  events: Prisma.PublicationEventOutboxCreateManyInput[],
  batchId: string,
  publicationId: string,
  revisionId: string,
  revisionHash: string,
) {
  const eventId = `publication.revision:${publicationId}:${revisionHash}`;
  events.push({
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
  });
}
