import { afterAll, expect, it } from "vitest";
import { ingestPublicationBatch } from "@/features/publications/server/publication-ingestion-service";
import {
  getPublicPublicationById,
  listPublications,
} from "@/features/publications/server/publication-public-read-service";
import {
  listPublicationSourceDirectory,
  listPublicationSourceOptions,
} from "@/features/publications/server/publication-source-directory-service";
import { publicationIngestionBatchRequestSchema } from "@/lib/api/schemas/request-publication-ingestion-schemas";
import { PUBLICATION_INGESTION_SERVICE_PRINCIPAL as principal } from "@/lib/auth/service-principal";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const sourceIds: string[] = [];
const batchIds: string[] = [];
const objectHashes: string[] = [];
const imageHashes: string[] = [];
function batch(label: string) {
  const sourceId = `persist-${crypto.randomUUID()}`;
  sourceIds.push(sourceId);
  return publicationIngestionBatchRequestSchema.parse({
    protocolVersion: "1",
    producerVersion: "integration-test",
    clientRunId: `${marker}-${label}`,
    batchId: `${marker}-${label}`,
    observedAt: "2026-09-01",
    sources: [
      {
        id: sourceId,
        name: label,
        organizationLevel: "university",
        allowedHosts: ["publication.example"],
      },
    ],
    items: [
      {
        sourceId,
        canonicalUrl: `https://publication.example/${marker}/${label}`,
        revisionHash: "a".repeat(64),
        observedAt: "2026-09-01",
        publicationType: "news",
        title: `${marker} ${label}`,
        publishedAt: "2026-09-01",
        objects: [],
      },
    ],
  });
}
type Batch = ReturnType<typeof batch>;
async function ingest(payload: Batch) {
  batchIds.push(payload.batchId);
  return ingestPublicationBatch({ payload, principal });
}
async function digest(value: string) {
  return Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  ).toString("hex");
}
afterAll(async () => {
  const publications = await db.publication.findMany({
    where: { sourceId: { in: sourceIds } },
    select: { id: true },
  });
  await db.publicationEventOutbox.deleteMany({
    where: { aggregateId: { in: publications.map((p) => p.id) } },
  });
  await db.publicationSource.deleteMany({ where: { id: { in: sourceIds } } });
  await db.ingestionBatch.deleteMany({ where: { batchId: { in: batchIds } } });
  await db.ingestionRun.deleteMany({
    where: { clientRunId: { startsWith: marker } },
  });
  await db.publicationObject.deleteMany({
    where: { sha256: { in: objectHashes } },
  });
  await db.publicationImageSource.deleteMany({
    where: { id: { in: imageHashes } },
  });
  await db.$disconnect();
});

it("publications.identity", async () => {
  const payload = batch("identity");
  const imageUrl = `https://publication.example/${marker}/photo.png`;
  const imageHash = await digest(imageUrl);
  imageHashes.push(imageHash);
  const objectHash = await digest(`${marker}-attachment`);
  objectHashes.push(objectHash);
  const base = payload.items[0];
  if (base.tombstone) throw new Error("Expected live publication");
  const item = {
    ...base,
    reporter: "Reporter",
    editor: "Editor",
    originalPublisher: "Original",
    author: "Author",
    imageSources: { [imageHash]: imageUrl },
    imageMetadata: {
      [imageHash]: { altText: "Photo", title: "Title", caption: "Caption" },
    },
    objects: [
      {
        kind: "asset" as const,
        sha256: objectHash,
        size: 3,
        contentType: "application/pdf",
        sortOrder: 2,
        altText: "Attachment",
        filename: "report.pdf",
        sourceUrl: `https://publication.example/${marker}/report.pdf`,
      },
    ],
  };
  payload.items = [item];
  const initial = (await ingest(payload)).results[0];
  const revision = await db.publicationRevision.findUniqueOrThrow({
    where: { id: initial.revisionId! },
    include: { objectLinks: true, imageSourceRefs: true },
  });
  expect(revision).toMatchObject({
    reporter: "Reporter",
    editor: "Editor",
    originalPublisher: "Original",
    author: "Author",
    imageSourceRefs: [
      expect.objectContaining({
        imageSourceId: imageHash,
        altText: "Photo",
        title: "Title",
        caption: "Caption",
      }),
    ],
    objectLinks: [
      expect.objectContaining({
        sortOrder: 2,
        altText: "Attachment",
        filename: "report.pdf",
        sourceUrl: item.objects[0].sourceUrl,
      }),
    ],
  });
  const replay = (
    await ingest({ ...payload, batchId: `${payload.batchId}-replay` })
  ).results[0];
  expect(replay).toMatchObject({
    status: "unchanged",
    publicationId: initial.publicationId,
    revisionId: initial.revisionId,
  });
  const changes = [
    { reporter: "Changed" },
    { editor: null },
    { originalPublisher: null },
    {
      imageMetadata: {
        [imageHash]: { ...item.imageMetadata[imageHash], caption: "Changed" },
      },
    },
    {
      imageMetadata: {
        [imageHash]: { ...item.imageMetadata[imageHash], altText: "Changed" },
      },
    },
    {
      imageMetadata: {
        [imageHash]: { ...item.imageMetadata[imageHash], title: "Changed" },
      },
    },
    ...["sortOrder", "altText", "filename", "sourceUrl"].map((field) => ({
      objects: [
        {
          ...item.objects[0],
          [field]:
            field === "sortOrder"
              ? 3
              : field === "sourceUrl"
                ? "https://publication.example/other.pdf"
                : "Changed",
        },
      ],
    })),
  ];
  for (const [index, change] of changes.entries()) {
    await expect(
      ingest({
        ...payload,
        batchId: `${payload.batchId}-conflict-${index}`,
        items: [{ ...item, ...change }],
      }),
    ).rejects.toThrow("A revision hash cannot change");
  }
  expect(
    await db.publicationRevision.findUniqueOrThrow({
      where: { id: revision.id },
      include: { objectLinks: true, imageSourceRefs: true },
    }),
  ).toEqual(revision);
  const next = (
    await ingest({
      ...payload,
      batchId: `${payload.batchId}-next`,
      items: [
        {
          ...item,
          revisionHash: "b".repeat(64),
          observedAt: "2026-09-02",
          reporter: null,
          editor: "Editor 2",
          imageMetadata: { [imageHash]: { caption: "Caption 2" } },
          objects: [{ ...item.objects[0], filename: "second.pdf" }],
        },
      ],
    })
  ).results[0];
  expect(next).toMatchObject({
    status: "updated",
    publicationId: initial.publicationId,
  });
  expect(next.revisionId).not.toBe(initial.revisionId);
  expect(
    await db.publicationObject.count({ where: { sha256: objectHash } }),
  ).toBe(1);
  expect(
    await db.publicationImageSource.count({ where: { id: imageHash } }),
  ).toBe(1);
  expect(
    await db.publicationRevision.count({
      where: { publicationId: initial.publicationId! },
    }),
  ).toBe(2);
  const detail = await getPublicPublicationById(initial.publicationId!);
  expect(detail?.revision).toMatchObject({
    reporter: null,
    editor: "Editor 2",
    originalPublisher: "Original",
    images: [
      {
        id: imageHash,
        url: `/api/publications/images/${imageHash}`,
        altText: null,
        title: null,
        caption: "Caption 2",
      },
    ],
  });
  const otherSource = batch("identity-source");
  const separate = (
    await ingest({
      ...otherSource,
      items: [{ ...base, sourceId: otherSource.sources[0].id }],
    })
  ).results[0];
  expect(separate.publicationId).not.toBe(initial.publicationId);
});

it("publications.outbox", async () => {
  const payload = batch("outbox");
  const initial = (await ingest(payload)).results[0];
  const publication = await db.publication.findUniqueOrThrow({
    where: { id: initial.publicationId! },
  });
  const storedBatch = await db.ingestionBatch.findUniqueOrThrow({
    where: {
      principalKey_batchId: {
        principalKey: principal.principalKey,
        batchId: payload.batchId,
      },
    },
  });
  expect(
    await db.publicationEventOutbox.findMany({
      where: { aggregateId: publication.id },
    }),
  ).toEqual([
    expect.objectContaining({
      eventId: `publication.revision:${publication.id}:${payload.items[0].revisionHash}`,
      eventType: "publication.revision.accepted",
      aggregateType: "publication",
      attempts: 0,
      publishedAt: null,
      payload: {
        batchId: storedBatch.id,
        publicationId: publication.id,
        revisionId: initial.revisionId,
        revisionHash: payload.items[0].revisionHash,
      },
    }),
  ]);
  await ingest({ ...payload, batchId: `${payload.batchId}-replay` });
  expect(
    await db.publicationEventOutbox.count({
      where: { aggregateId: publication.id },
    }),
  ).toBe(1);
  const blockedHash = await digest(`${marker}-outbox-fault`);
  const constraint = `publication_outbox_contract_${marker.replaceAll("-", "")}`;
  // Fixture-specific DB failure happens at the final outbox write, after
  // source/run/batch/publication/revision writes in the application transaction.
  await db.$executeRawUnsafe(
    `ALTER TABLE "PublicationEventOutbox" ADD CONSTRAINT "${constraint}" CHECK ((payload->>'revisionHash') <> '${blockedHash}')`,
  );
  try {
    const newPayload = batch("outbox-new-failure");
    for (const failed of [
      {
        ...payload,
        batchId: `${payload.batchId}-failure`,
        items: [
          {
            ...payload.items[0],
            revisionHash: blockedHash,
            observedAt: "2026-09-02",
            title: "Must roll back",
          },
        ],
      },
      {
        ...newPayload,
        items: [{ ...newPayload.items[0], revisionHash: blockedHash }],
      },
    ]) {
      await expect(ingest(failed)).rejects.toThrow();
      expect(
        await db.ingestionBatch.count({ where: { batchId: failed.batchId } }),
      ).toBe(0);
    }
    expect(
      await db.publication.findUniqueOrThrow({ where: { id: publication.id } }),
    ).toEqual(publication);
    expect(
      await db.publicationRevision.count({
        where: { publicationId: publication.id },
      }),
    ).toBe(1);
    expect(
      await db.publicationSource.findUnique({
        where: { id: newPayload.sources[0].id },
      }),
    ).toBeNull();
    expect(
      await db.ingestionRun.count({
        where: { clientRunId: newPayload.clientRunId },
      }),
    ).toBe(0);
    expect(
      await db.publicationEventOutbox.count({
        where: { aggregateId: publication.id },
      }),
    ).toBe(1);
  } finally {
    await db.$executeRawUnsafe(
      `ALTER TABLE "PublicationEventOutbox" DROP CONSTRAINT "${constraint}"`,
    );
  }
});

it("publications.reprint-folding", async () => {
  const payload = batch("folding");
  const base = payload.items[0];
  if (base.tombstone) throw new Error("Expected live publication");
  const specs = [
    {
      title: "Group A",
      level: "university",
      observed: "2026-09-01",
      date: "2026-09-01T16:00:00Z",
    },
    {
      title: "Ｇroup A",
      level: "college",
      observed: "2026-09-03",
      date: "2026-09-02T12:00:00+08:00",
    },
    {
      title: "Group B",
      level: "office",
      observed: "2026-09-01",
      date: "2026-09-02",
    },
    {
      title: "Group B",
      level: "office",
      observed: "2026-09-02",
      date: "2026-09-02",
    },
    {
      title: "Group C",
      level: "office",
      observed: "2026-09-02",
      date: "2026-09-02",
    },
    {
      title: "Group C",
      level: "office",
      observed: "2026-09-02",
      date: "2026-09-02",
    },
    {
      title: "Group A",
      level: "university",
      observed: "2026-09-01",
      date: "2026-09-01T15:59:59Z",
    },
    {
      title: "Singleton",
      level: "university",
      observed: "2026-09-01",
      date: "2026-09-02",
    },
  ];
  payload.sources = specs.map((s, i) => {
    const id = `${payload.sources[0].id}-${i}`;
    sourceIds.push(id);
    return {
      id,
      name: `${marker}-${i}`,
      organizationLevel: s.level,
      allowedHosts: ["publication.example"],
    };
  });
  payload.items = specs.map((s, i) => ({
    ...base,
    sourceId: payload.sources[i].id,
    title: `${marker} ${s.title}`,
    canonicalUrl: `${base.canonicalUrl}/${i}`,
    observedAt: s.observed,
    publishedAt: s.date,
  }));
  const result = await ingest(payload);
  const ids = result.results.map((r) => r.publicationId!);
  const filters = { source: payload.sources.map((s) => s.id) };
  const unfolded = await listPublications({ filters });
  expect(unfolded.pagination.total).toBe(8);
  expect(unfolded.data.every((row) => !Object.hasOwn(row, "foldGroup"))).toBe(
    true,
  );
  const expected = [
    ids[0],
    ids[3],
    [ids[4], ids[5]].sort()[0],
    ids[6],
    ids[7],
  ].sort();
  const folded = await listPublications({
    filters: { ...filters, fold: true },
  });
  expect(folded.pagination.total).toBe(5);
  expect(folded.data.map((r) => r.id).sort()).toEqual(expected);
  const paginated = await Promise.all(
    [1, 2, 3].map((page) =>
      listPublications({
        filters: { ...filters, fold: true },
        pagination: { page, pageSize: 2 },
      }),
    ),
  );
  expect(paginated.map((p) => p.pagination)).toEqual(
    [1, 2, 3].map((page) => ({ page, pageSize: 2, total: 5, totalPages: 3 })),
  );
  expect(paginated.flatMap((p) => p.data.map((r) => r.id))).toEqual(
    folded.data.map((r) => r.id),
  );
  const filtered = await listPublications({
    filters: { source: [payload.sources[1].id], fold: true },
  });
  expect(filtered.data.map((r) => r.id)).toEqual([ids[1]]);
  expect(filtered.data[0]).not.toHaveProperty("foldGroup");
});

it("publications.reprint-sibling-exposure", async () => {
  const payload = batch("siblings");
  payload.items = Array.from({ length: 24 }, (_, index) => ({
    ...payload.items[0],
    canonicalUrl: `${payload.items[0].canonicalUrl}/${index}`,
    publishedAt: index === 23 ? "2026-09-02" : "2026-09-01",
  }));
  const result = await ingest(payload);
  const ids = result.results.map((r) => r.publicationId!);
  const folded = await listPublications({
    filters: { source: [payload.sources[0].id], fold: true },
  });
  expect(folded.data).toHaveLength(2);
  expect(folded.data.find((r) => r.id !== ids[23])?.foldGroup).toEqual({
    siblingCount: 22,
  });
  expect(folded.data.find((r) => r.id === ids[23])).not.toHaveProperty(
    "foldGroup",
  );
  const unfolded = await listPublications({
    filters: { source: [payload.sources[0].id] },
    pagination: { pageSize: 100 },
  });
  expect(unfolded.data.every((row) => !Object.hasOwn(row, "foldGroup"))).toBe(
    true,
  );
  const detail = await getPublicPublicationById(ids[0]);
  expect(detail?.alsoPublishedIn.map((r) => r.id).sort()).toEqual(
    ids.slice(1, 23).sort(),
  );
  expect(detail?.alsoPublishedIn[0]).toMatchObject({
    canonicalUrl: expect.stringContaining("https://publication.example/"),
    source: {
      id: payload.sources[0].id,
      name: "siblings",
      organizationLevel: "university",
    },
    publishedAt: new Date("2026-08-31T16:00:00Z"),
  });
  expect((await getPublicPublicationById(ids[23]))?.alsoPublishedIn).toEqual(
    [],
  );
});

it("publications.source-registry", async () => {
  const payload = batch("registry");
  const levels = [
    "university",
    "office",
    "department",
    "college",
    "center",
    "research",
    "service",
    "program",
    "society",
    "journal",
    "student",
    "unknown",
  ];
  payload.sources = [...levels, "NEW_CRAWLER_LEVEL", undefined].map(
    (level, index) => {
      const id = `registry-${crypto.randomUUID()}`;
      sourceIds.push(id);
      return {
        id,
        name: `${marker}-${index}`,
        ...(level ? { organizationLevel: `  ${level.toUpperCase()}  ` } : {}),
        allowedHosts: ["publication.example"],
        blockedHosts: ["internal.example"],
        seedUrls: ["https://publication.example/private-seed"],
      };
    },
  );
  payload.items[0].sourceId = payload.sources[0].id;
  expect((await ingest(payload)).results[0].status).toBe("created");
  const disabledId = payload.sources[1].id;
  const discoveryId = payload.sources[2].id;
  await db.publicationSource.update({
    where: { id: disabledId },
    data: { enabled: false },
  });
  await db.publicationSource.update({
    where: { id: discoveryId },
    data: { discoveryOnly: true },
  });
  const directory = await listPublicationSourceDirectory();
  const owned = directory.groups
    .flatMap((g) => g.sources)
    .filter((s) => payload.sources.some((p) => p.id === s.id));
  expect(owned.map((s) => s.id).sort()).toEqual(
    payload.sources
      .map((s) => s.id)
      .filter((id) => id !== disabledId && id !== discoveryId)
      .sort(),
  );
  expect(directory.groups.map((g) => g.organizationLevel)).toEqual(
    levels.filter((level) =>
      directory.groups.some((g) => g.organizationLevel === level),
    ),
  );
  for (const entry of owned) {
    const expectedLevel = payload.sources.findIndex((s) => s.id === entry.id);
    expect(entry.organizationLevel).toBe(levels[expectedLevel] ?? "unknown");
    expect(entry).not.toHaveProperty("blockedHosts");
    expect(entry).not.toHaveProperty("seedUrls");
    expect(entry.publicationCount).toBe(
      entry.id === payload.sources[0].id ? 1 : 0,
    );
    expect(entry.lastPublishedAt).toEqual(
      entry.id === payload.sources[0].id
        ? new Date("2026-08-31T16:00:00Z")
        : null,
    );
  }
  const options = await listPublicationSourceOptions();
  expect(
    options
      .filter((s) => payload.sources.some((p) => p.id === s.id))
      .map((s) => s.id)
      .sort(),
  ).toEqual(owned.map((s) => s.id).sort());
});
