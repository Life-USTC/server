import type { Prisma } from "@/generated/prisma/client";
import type { PublicationObjectManifest } from "@/lib/api/schemas/request-publication-ingestion-schemas";
import { PublicationIngestionBadRequestError } from "./publication-ingestion-errors";
import { publicationObjectKey } from "./publication-ingestion-keys";

type TransactionClient = Prisma.TransactionClient;
type LinkedObject = {
  kind: PublicationObjectManifest["kind"];
  sha256: string;
  status: string;
};

export async function linkImageSources(
  tx: TransactionClient,
  revisionId: string,
  imageSources: Record<string, string>,
  imageMetadata: Record<
    string,
    { altText?: string | null; title?: string | null; caption?: string | null }
  > = {},
) {
  const sources = Object.entries(imageSources).map(([id, url]) => ({
    id,
    url,
  }));
  if (sources.length === 0) return;

  await tx.publicationImageSource.createMany({
    data: sources,
    skipDuplicates: true,
  });
  const storedSources = await tx.publicationImageSource.findMany({
    where: { id: { in: sources.map(({ id }) => id) } },
    select: { id: true, url: true },
  });
  for (const source of storedSources) {
    if (source.url !== imageSources[source.id]) {
      throw new PublicationIngestionBadRequestError(
        `Image source ${source.id} does not match its stored URL`,
      );
    }
  }
  await tx.publicationRevisionImageSource.createMany({
    data: sources.map(({ id }) => ({
      revisionId,
      imageSourceId: id,
      altText: imageMetadata[id]?.altText ?? null,
      title: imageMetadata[id]?.title ?? null,
      caption: imageMetadata[id]?.caption ?? null,
    })),
    skipDuplicates: true,
  });
}

export function objectsNeedingUpload(linked: LinkedObject[]) {
  // Only strict byte verification can move objects into these public states.
  return linked
    .filter(
      (object) => object.status !== "linked" && object.status !== "verified",
    )
    .map(({ kind, sha256 }) => ({ kind, sha256 }));
}

export async function linkObjects(
  tx: TransactionClient,
  batchId: string,
  revisionId: string,
  manifests: PublicationObjectManifest[],
): Promise<LinkedObject[]> {
  if (manifests.length === 0) return [];
  const seen = new Set<string>();
  for (const manifest of manifests) {
    const key = `${manifest.kind}:${manifest.sha256}`;
    if (seen.has(key)) {
      throw new PublicationIngestionBadRequestError(
        `Duplicate object manifest: ${key}`,
      );
    }
    seen.add(key);
  }

  await tx.publicationObject.createMany({
    data: manifests.map((manifest) => ({
      kind: manifest.kind,
      sha256: manifest.sha256,
      size: manifest.size,
      contentType: manifest.contentType,
      r2Key: publicationObjectKey(manifest.kind, manifest.sha256),
    })),
    skipDuplicates: true,
  });
  // Re-read after insertion so a concurrent first writer determines the
  // canonical MIME type and every claim uses the actual stored object.
  const storedObjects = await tx.publicationObject.findMany({
    where: { OR: manifests.map(({ kind, sha256 }) => ({ kind, sha256 })) },
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
  const objectsByKey = new Map(
    storedObjects.map((object) => [`${object.kind}:${object.sha256}`, object]),
  );
  const objects = manifests.map((manifest) => {
    const object = objectsByKey.get(`${manifest.kind}:${manifest.sha256}`);
    if (
      !object ||
      object.r2Key !== publicationObjectKey(manifest.kind, manifest.sha256) ||
      object.size !== manifest.size
    ) {
      throw new PublicationIngestionBadRequestError(
        `Object manifest does not match ${manifest.kind}/${manifest.sha256}`,
      );
    }
    return object;
  });

  await tx.ingestionBatchObject.createMany({
    data: objects.map((object) => ({
      batchId,
      objectId: object.id,
      expectedSha256: object.sha256,
      expectedSize: object.size,
      expectedContentType: object.contentType,
    })),
    skipDuplicates: true,
  });
  // Existing revision semantics were checked before linking. Its metadata is
  // immutable; a new revision receives its own links even for shared objects.
  await tx.publicationObjectLink.createMany({
    data: objects.map((object, index) => {
      const manifest = manifests[index];
      return {
        revisionId,
        objectId: object.id,
        role: manifest.kind,
        sortOrder: manifest.sortOrder ?? null,
        altText: manifest.altText ?? null,
        filename: manifest.filename ?? null,
        sourceUrl: manifest.sourceUrl ?? null,
      };
    }),
    skipDuplicates: true,
  });
  return objects.map(({ kind, sha256, status }) => ({ kind, sha256, status }));
}
