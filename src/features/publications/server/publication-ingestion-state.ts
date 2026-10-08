import type { Prisma } from "@/generated/prisma/client";
import type { PublicationIngestionBatchRequest } from "@/lib/api/schemas/request-publication-ingestion-schemas";
import {
  incomingRevisionSemanticsKey,
  storedRevisionSemanticsKey,
} from "./publication-ingestion-revision-semantics";

type Item = PublicationIngestionBatchRequest["items"][number];
type RevisionIdentity = {
  id: string;
  observedAt: Date;
  revisionHash: string;
  isTombstone: boolean;
};
type RevisionState = RevisionIdentity & { semantics: string };
type PublicationState = {
  id: string;
  lastSeenAt: Date;
  currentRevision: RevisionIdentity | null;
};

export type IngestionBatchState = {
  publications: Map<string, PublicationState>;
  revisions: Map<string, RevisionState>;
};

export function publicationIdentity(
  item: Pick<Item, "sourceId" | "canonicalUrl">,
) {
  return JSON.stringify([item.sourceId, item.canonicalUrl]);
}

export function revisionIdentity(publicationId: string, revisionHash: string) {
  return `${publicationId}:${revisionHash}`;
}

export async function loadIngestionBatchState(
  tx: Prisma.TransactionClient,
  items: Item[],
): Promise<IngestionBatchState> {
  const publications = await tx.publication.findMany({
    where: {
      OR: items.map(({ sourceId, canonicalUrl }) => ({
        sourceId,
        canonicalUrl,
      })),
    },
    select: {
      id: true,
      sourceId: true,
      canonicalUrl: true,
      lastSeenAt: true,
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
  const state: IngestionBatchState = {
    publications: new Map(
      publications.map((row) => [publicationIdentity(row), row]),
    ),
    revisions: new Map(),
  };
  const revisionKeys = items.flatMap((item) => {
    const publication = state.publications.get(publicationIdentity(item));
    return publication
      ? [{ publicationId: publication.id, revisionHash: item.revisionHash }]
      : [];
  });
  if (revisionKeys.length === 0) return state;
  const revisions = await tx.publicationRevision.findMany({
    where: { OR: revisionKeys },
    include: {
      objectLinks: {
        include: {
          object: { select: { kind: true, sha256: true, size: true } },
        },
      },
      imageSourceRefs: {
        include: { imageSource: { select: { id: true, url: true } } },
      },
    },
  });
  for (const revision of revisions) {
    state.revisions.set(
      revisionIdentity(revision.publicationId, revision.revisionHash),
      {
        id: revision.id,
        observedAt: revision.observedAt,
        revisionHash: revision.revisionHash,
        isTombstone: revision.isTombstone,
        semantics: storedRevisionSemanticsKey(revision),
      },
    );
  }
  return state;
}

export function rememberRevision(
  state: IngestionBatchState,
  publicationId: string,
  id: string,
  item: Item,
  observedAt: Date,
): RevisionState {
  const revision = {
    id,
    observedAt,
    revisionHash: item.revisionHash,
    isTombstone: item.tombstone,
    semantics: incomingRevisionSemanticsKey(item),
  };
  state.revisions.set(
    revisionIdentity(publicationId, item.revisionHash),
    revision,
  );
  return revision;
}
