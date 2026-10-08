import type { Prisma } from "@/generated/prisma/client";
import type {
  PublicationIngestionBatchRequest,
  PublicationObjectManifest,
} from "@/lib/api/schemas/request-publication-ingestion-schemas";
import {
  PublicationIngestionBadRequestError,
  type PublicationIngestionItemResult,
} from "./publication-ingestion-errors";
import { publicationObjectKey } from "./publication-ingestion-keys";

type PublicationItem = Extract<
  PublicationIngestionBatchRequest["items"][number],
  { tombstone: false }
>;
export type PendingPublicationLinks = {
  revisionId: string;
  item: PublicationItem;
  unchanged?: PublicationIngestionItemResult;
};

function objectIdentity(
  object: Pick<PublicationObjectManifest, "kind" | "sha256">,
) {
  return `${object.kind}:${object.sha256}`;
}

/** Register only items accepted by the sequential revision decisions. The first
 * accepted manifest wins MIME aliases; bytes and per-revision metadata stay immutable. */
export async function flushPublicationLinks(
  tx: Prisma.TransactionClient,
  batchId: string,
  links: PendingPublicationLinks[],
) {
  const manifests = new Map<string, PublicationObjectManifest>();
  const images = new Map<string, string>();
  for (const { item } of links) {
    const seen = new Set<string>();
    for (const manifest of item.objects) {
      const key = objectIdentity(manifest);
      if (seen.has(key)) {
        throw new PublicationIngestionBadRequestError(
          `Duplicate object manifest: ${key}`,
        );
      }
      seen.add(key);
      const previous = manifests.get(key);
      if (previous && previous.size !== manifest.size) {
        throw new PublicationIngestionBadRequestError(
          `Object manifest does not match ${manifest.kind}/${manifest.sha256}`,
        );
      }
      if (!previous) manifests.set(key, manifest);
    }
    for (const [id, url] of Object.entries(item.imageSources)) {
      if (images.has(id) && images.get(id) !== url) {
        throw new PublicationIngestionBadRequestError(
          `Image source ${id} does not match its stored URL`,
        );
      }
      images.set(id, url);
    }
  }

  if (manifests.size > 0) {
    await tx.publicationObject.createMany({
      data: [...manifests.values()].map((manifest) => ({
        kind: manifest.kind,
        sha256: manifest.sha256,
        size: manifest.size,
        contentType: manifest.contentType,
        r2Key: publicationObjectKey(manifest.kind, manifest.sha256),
      })),
      skipDuplicates: true,
    });
    // Read canonical rows after insertion, including a concurrent first
    // writer's MIME and actual byte-verification state.
    const storedObjects = await tx.publicationObject.findMany({
      where: {
        OR: [...manifests.values()].map(({ kind, sha256 }) => ({
          kind,
          sha256,
        })),
      },
      select: {
        id: true,
        kind: true,
        sha256: true,
        size: true,
        contentType: true,
        r2Key: true,
        status: true,
      },
    });
    const objects = new Map(
      storedObjects.map((object) => [objectIdentity(object), object]),
    );
    for (const [key, manifest] of manifests) {
      const object = objects.get(key);
      if (
        !object ||
        object.r2Key !== publicationObjectKey(manifest.kind, manifest.sha256) ||
        object.size !== manifest.size
      ) {
        throw new PublicationIngestionBadRequestError(
          `Object manifest does not match ${manifest.kind}/${manifest.sha256}`,
        );
      }
    }
    await tx.ingestionBatchObject.createMany({
      data: storedObjects.map((object) => ({
        batchId,
        objectId: object.id,
        expectedSha256: object.sha256,
        expectedSize: object.size,
        expectedContentType: object.contentType,
      })),
      skipDuplicates: true,
    });
    await tx.publicationObjectLink.createMany({
      data: links.flatMap(({ revisionId, item }) =>
        item.objects.map((manifest) => ({
          revisionId,
          objectId: objects.get(objectIdentity(manifest))!.id,
          role: manifest.kind,
          sortOrder: manifest.sortOrder ?? null,
          altText: manifest.altText ?? null,
          filename: manifest.filename ?? null,
          sourceUrl: manifest.sourceUrl ?? null,
        })),
      ),
      skipDuplicates: true,
    });
    for (const { item, unchanged } of links) {
      if (!unchanged) continue;
      const missing = item.objects
        .filter((manifest) => {
          const status = objects.get(objectIdentity(manifest))!.status;
          return status !== "linked" && status !== "verified";
        })
        .map(({ kind, sha256 }) => ({ kind, sha256 }));
      if (missing.length > 0) unchanged.objectsNeedingUpload = missing;
    }
  }

  if (images.size > 0) {
    await tx.publicationImageSource.createMany({
      data: [...images].map(([id, url]) => ({ id, url })),
      skipDuplicates: true,
    });
    const stored = await tx.publicationImageSource.findMany({
      where: { id: { in: [...images.keys()] } },
      select: { id: true, url: true },
    });
    for (const source of stored) {
      if (source.url !== images.get(source.id)) {
        throw new PublicationIngestionBadRequestError(
          `Image source ${source.id} does not match its stored URL`,
        );
      }
    }
    await tx.publicationRevisionImageSource.createMany({
      data: links.flatMap(({ revisionId, item }) =>
        Object.keys(item.imageSources).map((id) => ({
          revisionId,
          imageSourceId: id,
          altText: item.imageMetadata?.[id]?.altText ?? null,
          title: item.imageMetadata?.[id]?.title ?? null,
          caption: item.imageMetadata?.[id]?.caption ?? null,
        })),
      ),
      skipDuplicates: true,
    });
  }
}
