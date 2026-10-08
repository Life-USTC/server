import { createHash } from "node:crypto";
import pg from "pg";
import { afterAll, expect, it, vi } from "vitest";
import { ingestPublicationBatch } from "@/features/publications/server/publication-ingestion-service";
import { publicationIngestionBatchRequestSchema } from "@/lib/api/schemas/request-publication-ingestion-schemas";
import { PUBLICATION_INGESTION_SERVICE_PRINCIPAL as principal } from "@/lib/auth/service-principal";
import { prisma as runtime } from "@/lib/db/prisma";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const sources: string[] = [];
const batchIds: string[] = [];
const objectHashes: string[] = [];
const imageHashes: string[] = [];
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

function batch(label: string, count = 1) {
  const sourceId = `volume-${marker.slice(0, 20)}-${label}`;
  sources.push(sourceId);
  return publicationIngestionBatchRequestSchema.parse({
    protocolVersion: "1",
    producerVersion: "integration-test",
    clientRunId: `${marker}-${label}`,
    batchId: `${marker}-${label}`,
    observedAt: "2026-09-01T10:00:00+08:00",
    sources: [
      { id: sourceId, name: label, allowedHosts: ["publication.example"] },
    ],
    items: Array.from({ length: count }, (_, index) => {
      const imageSources = Object.fromEntries(
        Array.from({ length: 10 }, (_, image) => {
          const url = `https://publication.example/${marker}/${label}/${index}/${image}.jpg`;
          const hash = digest(url);
          imageHashes.push(hash);
          return [hash, url];
        }),
      );
      return {
        sourceId,
        canonicalUrl: `https://publication.example/${marker}/${label}/${index}`,
        revisionHash: digest(`${marker}/${label}/${index}`),
        observedAt: "2026-09-01T10:00:00+08:00",
        publicationType: "news",
        title: `${label} ${index}`,
        bodyText: "Publication body. ".repeat(500),
        imageSources,
        objects: ["body_html", "body_markdown", "raw_page"].map((kind) => {
          const sha256 = digest(`${marker}/${label}/${index}/${kind}`);
          objectHashes.push(sha256);
          return { kind, sha256, size: 8, contentType: "text/plain" };
        }),
      };
    }),
  });
}

type Batch = ReturnType<typeof batch>;
async function ingest(payload: Batch) {
  batchIds.push(payload.batchId);
  return ingestPublicationBatch({ payload, principal });
}
async function countQueries(payload: Batch) {
  // Observe actual pg calls, including transaction statements, without
  // replacing database behavior or counting calls to a Prisma mock.
  const queries = vi.spyOn(pg.Client.prototype, "query");
  try {
    const result = await ingest(payload);
    return { result, queries: queries.mock.calls.length };
  } finally {
    queries.mockRestore();
  }
}

afterAll(async () => {
  const publications = await db.publication.findMany({
    where: { sourceId: { in: sources } },
    select: { id: true },
  });
  await db.publicationEventOutbox.deleteMany({
    where: { aggregateId: { in: publications.map(({ id }) => id) } },
  });
  await db.publicationSource.deleteMany({ where: { id: { in: sources } } });
  await db.ingestionBatch.deleteMany({
    where: { batchId: { in: batchIds }, principalKey: principal.principalKey },
  });
  await db.ingestionRun.deleteMany({
    where: {
      clientRunId: { startsWith: marker },
      principalKey: principal.principalKey,
    },
  });
  await db.publicationObject.deleteMany({
    where: { sha256: { in: objectHashes } },
  });
  await db.publicationImageSource.deleteMany({
    where: { id: { in: imageHashes } },
  });
  await Promise.all([db.$disconnect(), runtime.$disconnect()]);
});

it("publications.ingestion-query-budget", async () => {
  const payload = batch("budget", 50);
  const first = await countQueries(payload);
  expect(first.result.results.map(({ status }) => status)).toEqual(
    Array(50).fill("created"),
  );
  // The previous nested upserts issued over 4,100 SQL queries for this batch.
  // Keep enough margin for fixed transaction/connection work while forbidding
  // a query for every image or object link.
  expect(first.queries).toBeGreaterThan(50);
  expect(first.queries).toBeLessThanOrEqual(750);
  const replay = await ingest(payload);
  expect(replay).toEqual(first.result);

  const redelivery = await countQueries({
    ...payload,
    batchId: `${payload.batchId}-redelivery`,
  });
  expect(redelivery.queries).toBeGreaterThan(50);
  expect(redelivery.queries).toBeLessThanOrEqual(750);
  expect(redelivery.result.results.map(({ status }) => status)).toEqual(
    Array(50).fill("unchanged"),
  );
  expect(
    redelivery.result.results.every(
      ({ objectsNeedingUpload }) => objectsNeedingUpload?.length === 3,
    ),
  ).toBe(true);
  const stored = await db.ingestionBatch.findMany({
    where: {
      batchId: { in: [payload.batchId, `${payload.batchId}-redelivery`] },
    },
    include: { _count: { select: { objects: true } } },
  });
  expect(stored.map(({ _count }) => _count.objects)).toEqual([150, 150]);
  expect(
    await db.publication.count({ where: { sourceId: payload.sources[0].id } }),
  ).toBe(50);
  expect(
    await db.publicationRevision.count({
      where: { publication: { sourceId: payload.sources[0].id } },
    }),
  ).toBe(50);
  const images = await db.publicationRevisionImageSource.findMany({
    where: { revision: { publication: { sourceId: payload.sources[0].id } } },
    select: { imageSource: { select: { id: true, url: true } } },
  });
  expect(images).toHaveLength(500);
  expect(
    Object.fromEntries(
      images.map(({ imageSource }) => [imageSource.id, imageSource.url]),
    ),
  ).toEqual(
    Object.assign(
      {},
      ...payload.items.map((item) => (item.tombstone ? {} : item.imageSources)),
    ),
  );
});

it("preserves first MIME, per-revision metadata and sequential duplicate items", async () => {
  const payload = batch("shared");
  const first = payload.items[0];
  if (first.tombstone) throw new Error("Expected publication");
  first.objects = [first.objects[0]];
  const imageHash = Object.keys(first.imageSources)[0];
  first.imageSources = { [imageHash]: first.imageSources[imageHash] };
  first.imageMetadata = {
    [imageHash]: {
      altText: "First image",
      title: "First title",
      caption: "First caption",
    },
  };
  first.objects[0].altText = "First object";
  first.objects[0].sortOrder = 1;
  const second = {
    ...first,
    revisionHash: digest(`${marker}/second-revision`),
    observedAt: "2026-09-02T10:00:00+08:00",
    imageMetadata: {
      [imageHash]: {
        altText: "Second image",
        title: "Second title",
        caption: "Second caption",
      },
    },
    objects: [
      {
        ...first.objects[0],
        contentType: "text/html",
        altText: "Second object",
        sortOrder: 2,
      },
    ],
  };
  payload.items = [first, second, second];
  const response = await ingest(payload);
  expect(response.results.map(({ status }) => status)).toEqual([
    "created",
    "updated",
    "unchanged",
  ]);
  expect(response.results[1].revisionId).toBe(response.results[2].revisionId);
  expect(await ingest(payload)).toEqual(response);
  const stored = await db.ingestionBatch.findUniqueOrThrow({
    where: {
      principalKey_batchId: {
        principalKey: principal.principalKey,
        batchId: payload.batchId,
      },
    },
    include: { objects: { include: { object: true } } },
  });
  expect(stored.objects).toHaveLength(1);
  expect(stored.objects[0].expectedContentType).toBe("text/plain");
  expect(stored.objects[0].object.contentType).toBe("text/plain");
  const revisions = await db.publicationRevision.findMany({
    where: { publicationId: response.results[0].publicationId! },
    orderBy: { observedAt: "asc" },
    include: { imageSourceRefs: true, objectLinks: true },
  });
  expect(revisions).toHaveLength(2);
  expect(
    revisions.map(({ imageSourceRefs }) => imageSourceRefs[0]),
  ).toMatchObject([
    {
      imageSourceId: imageHash,
      altText: "First image",
      title: "First title",
      caption: "First caption",
    },
    {
      imageSourceId: imageHash,
      altText: "Second image",
      title: "Second title",
      caption: "Second caption",
    },
  ]);
  expect(revisions.map(({ objectLinks }) => objectLinks[0])).toMatchObject([
    { altText: "First object", sortOrder: 1 },
    { altText: "Second object", sortOrder: 2 },
  ]);
});

it("rolls back the entire batch after a conflicting bulk object manifest", async () => {
  const initial = batch("registered");
  await ingest(initial);
  const original = initial.items[0];
  if (original.tombstone) throw new Error("Expected publication");
  const invalid = batch("rollback", 2);
  const conflicting = invalid.items[1];
  if (conflicting.tombstone) throw new Error("Expected publication");
  conflicting.objects[0] = { ...original.objects[0], size: 9 };
  await expect(ingest(invalid)).rejects.toThrow(
    "Object manifest does not match",
  );
  expect(
    await db.publicationSource.count({ where: { id: invalid.sources[0].id } }),
  ).toBe(0);
  expect(
    await db.ingestionBatch.count({ where: { batchId: invalid.batchId } }),
  ).toBe(0);
  expect(
    await db.ingestionRun.count({
      where: { clientRunId: invalid.clientRunId },
    }),
  ).toBe(0);
  const first = invalid.items[0];
  if (first.tombstone) throw new Error("Expected publication");
  expect(
    await db.publicationObject.count({
      where: { sha256: { in: first.objects.map(({ sha256 }) => sha256) } },
    }),
  ).toBe(0);
  expect(
    await db.publicationImageSource.count({
      where: { id: { in: Object.keys(first.imageSources) } },
    }),
  ).toBe(0);
  expect(
    (
      await db.publicationObject.findUniqueOrThrow({
        where: {
          kind_sha256: {
            kind: original.objects[0].kind,
            sha256: original.objects[0].sha256,
          },
        },
      })
    ).size,
  ).toBe(8);
});

it("rejects a stored image URL mismatch and rolls back new bulk rows", async () => {
  const payload = batch("image-conflict");
  const item = payload.items[0];
  if (item.tombstone) throw new Error("Expected publication");
  const imageHash = Object.keys(item.imageSources)[0];
  await db.publicationImageSource.create({
    data: { id: imageHash, url: "https://publication.example/wrong.jpg" },
  });
  await expect(ingest(payload)).rejects.toThrow(
    `Image source ${imageHash} does not match its stored URL`,
  );
  expect(
    await db.ingestionBatch.count({ where: { batchId: payload.batchId } }),
  ).toBe(0);
  expect(
    await db.publicationSource.count({ where: { id: payload.sources[0].id } }),
  ).toBe(0);
  expect(
    await db.publicationImageSource.count({
      where: { id: { in: Object.keys(item.imageSources).slice(1) } },
    }),
  ).toBe(0);
  expect(
    await db.publicationObject.count({
      where: { sha256: { in: item.objects.map(({ sha256 }) => sha256) } },
    }),
  ).toBe(0);
  expect(
    (
      await db.publicationImageSource.findUniqueOrThrow({
        where: { id: imageHash },
      })
    ).url,
  ).toBe("https://publication.example/wrong.jpg");
});

it("rejects a noncanonical stored object key without repairing it", async () => {
  const payload = batch("key-conflict");
  const item = payload.items[0];
  if (item.tombstone) throw new Error("Expected publication");
  const manifest = item.objects[0];
  const wrongKey = `invalid/${marker}/object-key`;
  await db.publicationObject.create({
    data: {
      kind: manifest.kind,
      sha256: manifest.sha256,
      size: manifest.size,
      contentType: manifest.contentType,
      r2Key: wrongKey,
    },
  });
  await expect(ingest(payload)).rejects.toThrow(
    "Object manifest does not match",
  );
  expect(
    await db.ingestionBatch.count({ where: { batchId: payload.batchId } }),
  ).toBe(0);
  expect(
    await db.publicationSource.count({ where: { id: payload.sources[0].id } }),
  ).toBe(0);
  expect(
    await db.publicationObject.count({
      where: {
        sha256: { in: item.objects.slice(1).map(({ sha256 }) => sha256) },
      },
    }),
  ).toBe(0);
  expect(
    (
      await db.publicationObject.findUniqueOrThrow({
        where: {
          kind_sha256: { kind: manifest.kind, sha256: manifest.sha256 },
        },
      })
    ).r2Key,
  ).toBe(wrongKey);
});
