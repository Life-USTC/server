import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLICATION_INGESTION_BATCH_MAX_ITEMS } from "@/features/publications/lib/publication-ingestion-limits";
import { Prisma } from "@/generated/prisma/client";
import { publicationIngestionBatchRequestSchema } from "@/lib/api/schemas/request-publication-ingestion-schemas";
import { publicationIngestionBatchResponseSchema } from "@/lib/api/schemas/response-publication-ingestion-schemas";
import { PUBLICATION_INGESTION_SERVICE_PRINCIPAL } from "@/lib/auth/service-principal";
import fixture from "../../../fixtures/publication-batch.json";

type QueryArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
  include?: unknown;
};

const fake = vi.hoisted(() => {
  const state = {
    nextId: 1,
    sources: new Map<string, Record<string, unknown>>(),
    runs: new Map<string, Record<string, unknown>>(),
    batches: new Map<string, Record<string, unknown>>(),
    publications: new Map<string, Record<string, unknown>>(),
    revisions: new Map<string, Record<string, unknown>>(),
    imageSources: new Map<string, Record<string, unknown>>(),
    imageSourceRefs: new Map<string, Record<string, unknown>>(),
    objects: new Map<string, Record<string, unknown>>(),
    claims: new Map<string, Record<string, unknown>>(),
    links: new Map<string, Record<string, unknown>>(),
    events: new Map<string, Record<string, unknown>>(),
  };

  function id(prefix: string) {
    return `${prefix}-${state.nextId++}`;
  }

  function value<T>(input: unknown) {
    return input as T;
  }

  function objectValue(input: unknown) {
    return (input ?? {}) as Record<string, unknown>;
  }

  function cloneMap(map: Map<string, Record<string, unknown>>) {
    return new Map(
      [...map.entries()].map(([key, entry]) => [key, structuredClone(entry)]),
    );
  }

  const tx = {
    user: {
      findUnique: vi.fn(async () => ({ isAdmin: true })),
    },
    ingestionRun: {
      upsert: vi.fn(async (args: QueryArgs) => {
        const where = value<{
          principalKey_clientRunId: {
            principalKey: string;
            clientRunId: string;
          };
        }>(args.where);
        const key = `${where.principalKey_clientRunId.principalKey}:${where.principalKey_clientRunId.clientRunId}`;
        const existing = state.runs.get(key);
        if (existing) {
          Object.assign(existing, args.update);
          return existing;
        }
        const created = { id: id("run"), ...objectValue(args.create) };
        state.runs.set(key, created);
        return created;
      }),
      update: vi.fn(async (args: QueryArgs) => {
        const where = value<{ id: string }>(args.where);
        const run = [...state.runs.values()].find(
          (entry) => entry.id === where.id,
        );
        if (!run) throw new Error("run not found");
        Object.assign(run, args.data);
        return run;
      }),
    },
    ingestionBatch: {
      findUnique: vi.fn(async (args: QueryArgs) => {
        const where = value<{
          principalKey_batchId: { principalKey: string; batchId: string };
        }>(args.where);
        const key = `${where.principalKey_batchId.principalKey}:${where.principalKey_batchId.batchId}`;
        return state.batches.get(key) ?? null;
      }),
      create: vi.fn(async (args: QueryArgs) => {
        const data = value<Record<string, unknown>>(args.data);
        const created = {
          id: id("batch"),
          result: null,
          ...data,
        } as Record<string, unknown>;
        const key = `${String(created.principalKey)}:${String(created.batchId)}`;
        state.batches.set(key, created);
        return created;
      }),
      update: vi.fn(async (args: QueryArgs) => {
        const where = value<{ id: string }>(args.where);
        const batch = [...state.batches.values()].find(
          (entry) => entry.id === where.id,
        );
        if (!batch) throw new Error("batch not found");
        Object.assign(batch, args.data);
        return batch;
      }),
    },
    publicationSource: {
      upsert: vi.fn(async (args: QueryArgs) => {
        const where = value<{ id: string }>(args.where);
        const existing = state.sources.get(where.id);
        if (existing) {
          Object.assign(existing, args.update);
          return existing;
        }
        const created = {
          id: id("source"),
          enabled: true,
          ...objectValue(args.create),
        };
        state.sources.set(where.id, created);
        return created;
      }),
    },
    publication: {
      findMany: vi.fn(async (args: QueryArgs) => {
        const keys = value<{
          OR: Array<{ sourceId: string; canonicalUrl: string }>;
        }>(args.where).OR;
        return [...state.publications.values()]
          .filter((entry) =>
            keys.some(
              (key) =>
                entry.sourceId === key.sourceId &&
                entry.canonicalUrl === key.canonicalUrl,
            ),
          )
          .map((publication) => {
            const revision = publication.currentRevisionId
              ? state.revisions.get(String(publication.currentRevisionId))
              : null;
            return {
              ...publication,
              currentRevision: revision
                ? {
                    id: revision.id,
                    observedAt: revision.observedAt,
                    revisionHash: revision.revisionHash,
                    isTombstone: revision.isTombstone ?? false,
                  }
                : null,
            };
          });
      }),
      create: vi.fn(async (args: QueryArgs) => {
        const created = { id: id("publication"), ...objectValue(args.data) };
        state.publications.set(String(created.id), created);
        return created;
      }),
      update: vi.fn(async (args: QueryArgs) => {
        const where = value<{ id: string }>(args.where);
        const publication = state.publications.get(where.id);
        if (!publication) throw new Error("publication not found");
        Object.assign(publication, args.data);
        return publication;
      }),
    },
    publicationRevision: {
      findMany: vi.fn(async (args: QueryArgs) => {
        const keys = value<{
          OR: Array<{ publicationId: string; revisionHash: string }>;
        }>(args.where).OR;
        return [...state.revisions.values()]
          .filter((entry) =>
            keys.some(
              (key) =>
                entry.publicationId === key.publicationId &&
                entry.revisionHash === key.revisionHash,
            ),
          )
          .map((revision) => {
            return {
              ...revision,
              objectLinks: [...state.links.values()]
                .filter((link) => link.revisionId === revision.id)
                .map((link) => ({
                  altText: (link.altText as string | null | undefined) ?? null,
                  filename: link.filename ?? null,
                  sourceUrl: link.sourceUrl ?? null,
                  object:
                    [...state.objects.values()].find(
                      (object) => object.id === link.objectId,
                    ) ?? null,
                  role: String(link.role),
                  sortOrder:
                    (link.sortOrder as number | null | undefined) ?? null,
                })),
              imageSourceRefs: [...state.imageSourceRefs.values()]
                .filter((link) => link.revisionId === revision.id)
                .map((link) => ({
                  altText: link.altText ?? null,
                  title: link.title ?? null,
                  caption: link.caption ?? null,
                  imageSource:
                    [...state.imageSources.values()].find(
                      (source) => source.id === link.imageSourceId,
                    ) ?? null,
                })),
            };
          });
      }),
      create: vi.fn(async (args: QueryArgs) => {
        const created = {
          id: id("revision"),
          isTombstone: false,
          ...objectValue(args.data),
        };
        state.revisions.set(String(created.id), created);
        return created;
      }),
      update: vi.fn(async (args: QueryArgs) => {
        const where = value<{ id: string }>(args.where);
        const revision = state.revisions.get(where.id);
        if (!revision) throw new Error("revision not found");
        Object.assign(revision, args.data);
        return revision;
      }),
    },
    publicationImageSource: {
      createMany: vi.fn(async (args: QueryArgs) =>
        createRows(state.imageSources, args, (row) => String(row.id)),
      ),
      findMany: vi.fn(async (args: QueryArgs) => {
        const ids = value<{ id: { in: string[] } }>(args.where).id.in;
        return [...state.imageSources.values()].filter((row) =>
          ids.includes(String(row.id)),
        );
      }),
    },
    publicationRevisionImageSource: {
      createMany: vi.fn(async (args: QueryArgs) =>
        createRows(
          state.imageSourceRefs,
          args,
          (row) => `${row.revisionId}:${row.imageSourceId}`,
        ),
      ),
    },
    publicationObject: {
      createMany: vi.fn(async (args: QueryArgs) =>
        createRows(state.objects, args, (row) => `${row.kind}:${row.sha256}`, {
          status: "pending",
          verifiedAt: null,
        }),
      ),
      findMany: vi.fn(async (args: QueryArgs) => {
        const keys = value<{ OR: Array<{ kind: string; sha256: string }> }>(
          args.where,
        ).OR;
        return [...state.objects.values()].filter((row) =>
          keys.some(
            (key) => key.kind === row.kind && key.sha256 === row.sha256,
          ),
        );
      }),
    },
    ingestionBatchObject: {
      createMany: vi.fn(async (args: QueryArgs) =>
        createRows(
          state.claims,
          args,
          (row) => `${row.batchId}:${row.objectId}`,
        ),
      ),
    },
    publicationObjectLink: {
      createMany: vi.fn(async (args: QueryArgs) =>
        createRows(
          state.links,
          args,
          (row) => `${row.revisionId}:${row.objectId}:${row.role}`,
        ),
      ),
    },
    publicationEventOutbox: {
      createMany: vi.fn(async (args: QueryArgs) =>
        createRows(state.events, args, (row) => String(row.eventId)),
      ),
    },
  };

  function createRows(
    rows: Map<string, Record<string, unknown>>,
    args: QueryArgs,
    key: (row: Record<string, unknown>) => string,
    defaults: Record<string, unknown> = {},
  ) {
    let count = 0;
    for (const data of Array.isArray(args.data)
      ? args.data
      : [objectValue(args.data)]) {
      const rowKey = key(data);
      if (rows.has(rowKey)) continue;
      rows.set(rowKey, {
        id: rows === state.imageSourceRefs ? rowKey : id("row"),
        ...defaults,
        ...data,
      });
      count += 1;
    }
    return { count };
  }

  const prisma = {
    $transaction: vi.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) => {
        const snapshot = {
          nextId: state.nextId,
          sources: cloneMap(state.sources),
          runs: cloneMap(state.runs),
          batches: cloneMap(state.batches),
          publications: cloneMap(state.publications),
          revisions: cloneMap(state.revisions),
          imageSources: cloneMap(state.imageSources),
          imageSourceRefs: cloneMap(state.imageSourceRefs),
          objects: cloneMap(state.objects),
          claims: cloneMap(state.claims),
          links: cloneMap(state.links),
          events: cloneMap(state.events),
        };
        try {
          return await callback(tx);
        } catch (error) {
          state.nextId = snapshot.nextId;
          for (const [name, map] of Object.entries(snapshot)) {
            if (name === "nextId") continue;
            const target = state[name as keyof typeof state];
            if (!(target instanceof Map)) continue;
            target.clear();
            for (const [key, value] of map as Map<
              string,
              Record<string, unknown>
            >) {
              target.set(key, value);
            }
          }
          throw error;
        }
      },
    ),
    ingestionBatch: {
      findUnique: tx.ingestionBatch.findUnique,
    },
  };

  function clear() {
    state.nextId = 1;
    for (const map of [
      state.sources,
      state.runs,
      state.batches,
      state.publications,
      state.revisions,
      state.imageSources,
      state.imageSourceRefs,
      state.objects,
      state.claims,
      state.links,
      state.events,
    ]) {
      map.clear();
    }
    vi.clearAllMocks();
  }

  return { clear, prisma, state };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: fake.prisma }));

const { logAppEventMock } = vi.hoisted(() => ({ logAppEventMock: vi.fn() }));
vi.mock("@/lib/log/app-logger", () => ({ logAppEvent: logAppEventMock }));

import {
  ingestPublicationBatch,
  PUBLICATION_INGESTION_TRANSACTION_MAX_ATTEMPTS,
  PUBLICATION_INGESTION_TRANSACTION_TIMEOUT_MS,
  PublicationIngestionBadRequestError,
} from "@/features/publications/server/publication-ingestion-service";

const parsedFixture = publicationIngestionBatchRequestSchema.parse(fixture);
const principal = PUBLICATION_INGESTION_SERVICE_PRINCIPAL;

function transactionTimeoutError() {
  return new Prisma.PrismaClientKnownRequestError(
    "Transaction API error: Transaction not found",
    { code: "P2028", clientVersion: "test" },
  );
}

function uniqueViolationError() {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`principalKey`,`batchId`)",
    { code: "P2002", clientVersion: "test" },
  );
}

function payloadFor(item: Record<string, unknown>, batchId: string) {
  return publicationIngestionBatchRequestSchema.parse({
    ...parsedFixture,
    batchId,
    clientRunId: "run-1",
    items: [{ ...parsedFixture.items[0], ...item }],
  });
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

function payloadWithSource(
  sourceOverrides: Record<string, unknown>,
  batchId: string,
) {
  return publicationIngestionBatchRequestSchema.parse({
    ...parsedFixture,
    batchId,
    clientRunId: "run-source",
    sources: [{ ...parsedFixture.sources[0], ...sourceOverrides }],
  });
}

describe("publication source registration", () => {
  beforeEach(() => fake.clear());

  it("stores the crawler's organization level when it is a known one", async () => {
    await ingestPublicationBatch({
      payload: payloadWithSource(
        { organizationLevel: "office" },
        "batch-source-level-known",
      ),
      principal,
    });

    expect(fake.state.sources.get("ustc-news")).toMatchObject({
      organizationLevel: "office",
    });
  });

  it("degrades an unrecognized level to unknown instead of failing the batch", async () => {
    // config/sources.yaml lives in the crawler repo and can gain a level at
    // any time; losing one source's grouping beats rejecting its articles.
    const response = await ingestPublicationBatch({
      payload: payloadWithSource(
        { organizationLevel: "institute" },
        "batch-source-level-unknown",
      ),
      principal,
    });

    expect(response.results[0].status).toBe("created");
    expect(fake.state.sources.get("ustc-news")).toMatchObject({
      organizationLevel: "unknown",
    });
  });

  it("upserts a source idempotently across batches", async () => {
    await ingestPublicationBatch({
      payload: payloadWithSource(
        { name: "USTC News", organizationLevel: "university" },
        "batch-source-first",
      ),
      principal,
    });
    await ingestPublicationBatch({
      payload: payloadWithSource(
        { name: "中国科学技术大学新闻网", organizationLevel: "office" },
        "batch-source-second",
      ),
      principal,
    });

    expect(fake.state.sources.size).toBe(1);
    expect(fake.state.sources.get("ustc-news")).toMatchObject({
      name: "中国科学技术大学新闻网",
      organizationLevel: "office",
    });
  });

  it("leaves a persisted level untouched for a minimal descriptor", async () => {
    await ingestPublicationBatch({
      payload: payloadWithSource(
        { organizationLevel: "college" },
        "batch-source-full",
      ),
      principal,
    });
    await ingestPublicationBatch({
      payload: publicationIngestionBatchRequestSchema.parse({
        ...parsedFixture,
        batchId: "batch-source-minimal",
        clientRunId: "run-source",
        sources: [{ id: "ustc-news", name: "USTC News" }],
      }),
      principal,
    });

    expect(fake.state.sources.get("ustc-news")).toMatchObject({
      organizationLevel: "college",
    });
  });
});

describe("publication ingestion transaction", () => {
  beforeEach(() => fake.clear());

  it("normalizes validated image source URLs into revision registry links", async () => {
    const imageUrl = "https://news.ustc.edu.cn/images/campus.png";
    const imageHash = await sha256Text(imageUrl);
    const response = await ingestPublicationBatch({
      payload: payloadFor(
        { imageSources: { [imageHash]: imageUrl }, objects: [] },
        "batch-image-source-registry",
      ),
      principal,
    });

    expect(response.results[0].status).toBe("created");
    expect([...fake.state.imageSources.values()]).toEqual([
      { id: imageHash, url: imageUrl },
    ]);
    const revision = [...fake.state.revisions.values()][0];
    expect([...fake.state.imageSourceRefs.values()]).toEqual([
      {
        id: `${revision?.id}:${imageHash}`,
        altText: null,
        title: null,
        caption: null,
        revisionId: revision?.id,
        imageSourceId: imageHash,
      },
    ]);
    expect(revision).not.toHaveProperty("imageSources");
  });

  it("preserves revision metadata on replay and rejects changed attribution or image captions under the same hash", async () => {
    const url = "https://news.ustc.edu.cn/images/metadata.png";
    const hash = await sha256Text(url);
    const item = {
      reporter: "Reporter",
      editor: "Editor",
      originalPublisher: "Publisher",
      imageSources: { [hash]: url },
      imageMetadata: {
        [hash]: { altText: "Alt", title: "Title", caption: "Caption" },
      },
      objects: [],
    };
    const first = await ingestPublicationBatch({
      payload: payloadFor(item, "metadata-first"),
      principal,
    });
    expect(first.results[0].status).toBe("created");
    expect([...fake.state.revisions.values()][0]).toMatchObject({
      reporter: "Reporter",
      editor: "Editor",
      originalPublisher: "Publisher",
    });
    expect([...fake.state.imageSourceRefs.values()][0]).toMatchObject({
      altText: "Alt",
      title: "Title",
      caption: "Caption",
    });
    const replay = await ingestPublicationBatch({
      payload: payloadFor(item, "metadata-replay"),
      principal,
    });
    expect(replay.results[0].status).toBe("unchanged");
    for (const [index, changed] of [
      { ...item, reporter: "Other" },
      {
        ...item,
        imageMetadata: {
          [hash]: { altText: "Alt", title: "Title", caption: "Changed" },
        },
      },
    ].entries()) {
      await expect(
        ingestPublicationBatch({
          payload: payloadFor(changed, `metadata-conflict-${index}`),
          principal,
        }),
      ).rejects.toBeInstanceOf(PublicationIngestionBadRequestError);
    }
  });

  it("rejects an image source key whose digest does not match its URL", async () => {
    const payload = payloadFor(
      {
        imageSources: {
          ["a".repeat(64)]: "https://news.ustc.edu.cn/images/campus.png",
        },
        objects: [],
      },
      "batch-image-source-hash-mismatch",
    );

    await expect(
      ingestPublicationBatch({ payload, principal }),
    ).rejects.toBeInstanceOf(PublicationIngestionBadRequestError);
    expect(fake.state.imageSources.size).toBe(0);
    expect(fake.state.imageSourceRefs.size).toBe(0);
    expect(fake.state.publications.size).toBe(0);
  });

  it("rolls back a rejected manifest item instead of retaining partial rows", async () => {
    const manifest = {
      kind: "body_html" as const,
      sha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      size: 4,
      contentType: "text/html",
    };
    const payload = payloadFor(
      { objects: [manifest, manifest] },
      "batch-manifest-conflict",
    );

    await expect(
      ingestPublicationBatch({ payload, principal }),
    ).rejects.toBeInstanceOf(PublicationIngestionBadRequestError);
    expect(fake.state.sources.size).toBe(0);
    expect(fake.state.batches.size).toBe(0);
    expect(fake.state.publications.size).toBe(0);
    expect(fake.state.revisions.size).toBe(0);
    expect(fake.state.imageSources.size).toBe(0);
    expect(fake.state.imageSourceRefs.size).toBe(0);
    expect(fake.state.objects.size).toBe(0);
    expect(fake.state.claims.size).toBe(0);
    expect(fake.state.links.size).toBe(0);
  });

  it("identifies duplicate URLs with distinct revision hashes in each result", async () => {
    const firstHash =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const secondHash =
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const firstItem = {
      ...parsedFixture.items[0],
      revisionHash: firstHash,
      title: "First revision",
    };
    const secondItem = {
      ...parsedFixture.items[0],
      revisionHash: secondHash,
      title: "Second revision",
    };
    const payload = publicationIngestionBatchRequestSchema.parse({
      ...parsedFixture,
      batchId: "batch-duplicate-url-revisions",
      clientRunId: "run-duplicate-url-revisions",
      items: [firstItem, secondItem],
    });

    const response = await ingestPublicationBatch({ payload, principal });

    expect(response.results).toHaveLength(2);
    expect(response.results).toEqual([
      expect.objectContaining({
        canonicalUrl: firstItem.canonicalUrl,
        sourceId: firstItem.sourceId,
        revisionHash: firstHash,
        status: "created",
      }),
      expect.objectContaining({
        canonicalUrl: secondItem.canonicalUrl,
        sourceId: secondItem.sourceId,
        revisionHash: secondHash,
        status: "updated",
      }),
    ]);
    expect(response.results[0].revisionHash).not.toBe(
      response.results[1].revisionHash,
    );
  });

  it("reuses the canonical MIME and records it on every batch claim", async () => {
    const sha256 =
      "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
    const canonical = {
      kind: "asset" as const,
      sha256,
      size: 3,
      contentType: "application/msword",
    };
    const alias = {
      ...canonical,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    await ingestPublicationBatch({
      payload: payloadFor(
        {
          revisionHash:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          objects: [canonical],
        },
        "batch-canonical-mime-original",
      ),
      principal,
    });
    const response = await ingestPublicationBatch({
      payload: payloadFor(
        {
          revisionHash:
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          observedAt: "2026-09-02",
          objects: [alias],
        },
        "batch-canonical-mime-alias",
      ),
      principal,
    });

    expect(response.results[0].status).toBe("updated");
    expect([...fake.state.objects.values()]).toEqual([
      expect.objectContaining({
        kind: canonical.kind,
        sha256,
        size: canonical.size,
        contentType: canonical.contentType,
      }),
    ]);
    expect([...fake.state.claims.values()]).toEqual([
      expect.objectContaining({ expectedContentType: canonical.contentType }),
      expect.objectContaining({ expectedContentType: canonical.contentType }),
    ]);
  });

  it("rejects an object size mismatch once bytes are verified", async () => {
    const sha256 =
      "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
    const original = {
      kind: "asset" as const,
      sha256,
      size: 3,
      contentType: "application/msword",
    };
    await ingestPublicationBatch({
      payload: payloadFor(
        { objects: [original] },
        "batch-size-mismatch-original",
      ),
      principal,
    });
    const stored = [...fake.state.objects.values()][0];
    stored.status = "linked";
    stored.verifiedAt = new Date("2026-01-01T00:00:00Z");

    await expect(
      ingestPublicationBatch({
        payload: payloadFor(
          {
            revisionHash:
              "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            observedAt: "2026-09-02",
            objects: [
              {
                ...original,
                size: 4,
                contentType:
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              },
            ],
          },
          "batch-size-mismatch-alias",
        ),
        principal,
      }),
    ).rejects.toBeInstanceOf(PublicationIngestionBadRequestError);

    expect(fake.state.objects.size).toBe(1);
    expect(fake.state.claims.size).toBe(1);
    expect([...fake.state.objects.values()][0]).toMatchObject({
      size: original.size,
      contentType: original.contentType,
    });
  });

  it("rejects a conflicting object manifest before bytes are verified", async () => {
    const sha256 =
      "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
    const stale = {
      kind: "asset" as const,
      sha256,
      size: 3,
      contentType: "application/msword",
    };
    await ingestPublicationBatch({
      payload: payloadFor({ objects: [stale] }, "batch-size-heal-original"),
      principal,
    });
    const healed = {
      ...stale,
      size: 4,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    await expect(
      ingestPublicationBatch({
        payload: payloadFor(
          {
            revisionHash:
              "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            observedAt: "2026-09-02",
            objects: [healed],
          },
          "batch-size-heal-updated",
        ),
        principal,
      }),
    ).rejects.toBeInstanceOf(PublicationIngestionBadRequestError);

    expect(fake.state.objects.size).toBe(1);
    expect([...fake.state.objects.values()][0]).toMatchObject(stale);
    expect(fake.state.claims.size).toBe(1);
  });

  it("accepts a same-revision replay with a MIME alias", async () => {
    const sha256 =
      "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    const revisionHash =
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const original = {
      kind: "asset" as const,
      sha256,
      size: 3,
      contentType: "application/msword",
    };
    await ingestPublicationBatch({
      payload: payloadFor(
        { revisionHash, objects: [original] },
        "batch-revision-mime-original",
      ),
      principal,
    });

    const response = await ingestPublicationBatch({
      payload: payloadFor(
        {
          revisionHash,
          observedAt: "2026-09-02",
          objects: [
            {
              ...original,
              contentType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            },
          ],
        },
        "batch-revision-mime-alias",
      ),
      principal,
    });

    expect(response.results[0].status).toBe("updated");
    expect(fake.state.revisions.size).toBe(1);
    expect(fake.state.claims.size).toBe(2);
    expect([...fake.state.claims.values()][1]).toMatchObject({
      expectedContentType: original.contentType,
    });
  });

  it.each([
    ["title", { title: "Changed title" }],
    ["body", { bodyText: "Changed body" }],
    [
      "objects",
      {
        objects: [
          {
            kind: "body_html" as const,
            sha256:
              "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            size: 4,
            contentType: "text/html",
          },
        ],
      },
    ],
  ])(
    "rejects changed %s semantics for an existing revision hash",
    async (_field, changedFields) => {
      const revisionHash =
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      await ingestPublicationBatch({
        payload: payloadFor(
          { revisionHash, title: "Original title", bodyText: "Original body" },
          "batch-semantic-original",
        ),
        principal,
      });

      await expect(
        ingestPublicationBatch({
          payload: payloadFor(
            {
              revisionHash,
              observedAt: "2026-09-02",
              ...changedFields,
            },
            "batch-semantic-changed",
          ),
          principal,
        }),
      ).rejects.toBeInstanceOf(PublicationIngestionBadRequestError);

      const publication = [...fake.state.publications.values()][0];
      expect(publication?.title).toBe("Original title");
      const revision = [...fake.state.revisions.values()][0];
      expect(revision?.bodyText).toBe("Original body");
      expect(fake.state.revisions.size).toBe(1);
      expect(fake.state.objects.size).toBe(0);
      expect(fake.state.links.size).toBe(0);
    },
  );

  it("keeps the newest observation after an older revision reappears", async () => {
    const a =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const b =
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    const first = await ingestPublicationBatch({
      payload: payloadFor(
        { revisionHash: a, observedAt: "2026-09-01", title: "A" },
        "batch-a-day-1",
      ),
      principal,
    });
    const second = await ingestPublicationBatch({
      payload: payloadFor(
        { revisionHash: b, observedAt: "2026-09-02", title: "B" },
        "batch-b-day-2",
      ),
      principal,
    });
    const third = await ingestPublicationBatch({
      payload: payloadFor(
        { revisionHash: a, observedAt: "2026-09-03", title: "A" },
        "batch-a-day-3",
      ),
      principal,
    });
    const retry = await ingestPublicationBatch({
      payload: payloadFor(
        { revisionHash: b, observedAt: "2026-09-02", title: "B" },
        "batch-b-day-2-retry",
      ),
      principal,
    });

    expect(first.results[0].status).toBe("created");
    expect(second.results[0].status).toBe("updated");
    expect(third.results[0].status).toBe("updated");
    expect(retry.results[0].status).toBe("unchanged");
    const publication = [...fake.state.publications.values()][0];
    const current = fake.state.revisions.get(
      String(publication.currentRevisionId),
    );
    expect(current?.revisionHash).toBe(a);
    expect((current?.observedAt as Date | undefined)?.toISOString()).toBe(
      "2026-09-02T16:00:00.000Z",
    );
    const revisionA = [...fake.state.revisions.values()].find(
      (revision) => revision.revisionHash === a,
    );
    expect((revisionA?.observedAt as Date | undefined)?.toISOString()).toBe(
      "2026-09-02T16:00:00.000Z",
    );
  });

  it("returns host validation failures per item while committing valid items", async () => {
    const payload = publicationIngestionBatchRequestSchema.parse({
      ...parsedFixture,
      batchId: "batch-partial-source-rejection",
      clientRunId: "run-partial-source-rejection",
      items: [
        parsedFixture.items[0],
        {
          ...parsedFixture.items[0],
          canonicalUrl: "https://evil.example.invalid/not-ustc.html",
          revisionHash:
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      ],
    });

    const response = await ingestPublicationBatch({ payload, principal });

    expect(response.results.map(({ status }) => status)).toEqual([
      "created",
      "rejected",
    ]);
    expect(response.results[1]).toMatchObject({
      error: "canonicalUrl is outside the source allowed hosts",
      canonicalUrl: "https://evil.example.invalid/not-ustc.html",
      sourceId: "ustc-news",
      revisionHash:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      publicationId: null,
      revisionId: null,
    });
    expect(fake.state.publications.size).toBe(1);
    expect(fake.state.revisions.size).toBe(1);
    expect(fake.state.events.size).toBe(1);
  });

  it("treats an unknown publication tombstone as an idempotent no-op", async () => {
    const original = parsedFixture.items[0];
    const payload = publicationIngestionBatchRequestSchema.parse({
      ...parsedFixture,
      batchId: "batch-unknown-publication-tombstone",
      items: [
        {
          sourceId: original.sourceId,
          canonicalUrl: original.canonicalUrl,
          revisionHash: original.revisionHash,
          observedAt: original.observedAt,
          tombstone: true,
        },
      ],
    });

    const response = await ingestPublicationBatch({ payload, principal });

    expect(response.results).toEqual([
      {
        canonicalUrl: original.canonicalUrl,
        revisionHash: original.revisionHash,
        sourceId: original.sourceId,
        status: "unchanged",
        publicationId: null,
        revisionId: null,
      },
    ]);
    expect(fake.state.publications.size).toBe(0);
    expect(fake.state.revisions.size).toBe(0);
    expect(fake.state.events.size).toBe(0);
  });

  it("configures a transaction budget for the maximum valid batch size", async () => {
    const payload = publicationIngestionBatchRequestSchema.parse({
      ...parsedFixture,
      batchId: "batch-maximum-size",
      clientRunId: "run-maximum-size",
      items: Array.from(
        { length: PUBLICATION_INGESTION_BATCH_MAX_ITEMS },
        (_, index) => ({
          ...parsedFixture.items[0],
          canonicalUrl: `https://news.ustc.edu.cn/example/${index}.html`,
          revisionHash: index.toString(16).padStart(64, "0"),
          objects: [],
        }),
      ),
    });

    const response = await ingestPublicationBatch({ payload, principal });

    expect(response.results).toHaveLength(
      PUBLICATION_INGESTION_BATCH_MAX_ITEMS,
    );
    expect(response.results.every(({ status }) => status === "created")).toBe(
      true,
    );
    expect(PUBLICATION_INGESTION_TRANSACTION_TIMEOUT_MS).toBe(45_000);
    expect(PUBLICATION_INGESTION_TRANSACTION_TIMEOUT_MS).toBeLessThan(60_000);
    expect(fake.prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: PUBLICATION_INGESTION_TRANSACTION_TIMEOUT_MS },
    );
  });

  it("returns an interactive transaction timeout without repeating the same work", async () => {
    const error = transactionTimeoutError();
    fake.prisma.$transaction.mockRejectedValueOnce(error);
    const payload = payloadFor({}, "batch-transaction-timeout");

    await expect(ingestPublicationBatch({ payload, principal })).rejects.toBe(
      error,
    );
    expect(fake.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(fake.state.batches.size).toBe(0);
    expect(fake.state.publications.size).toBe(0);
  });

  it("retries a serialization conflict and commits without duplicating the batch", async () => {
    fake.prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Write conflict", {
        code: "P2034",
        clientVersion: "test",
      }),
    );
    const payload = payloadFor({}, "batch-serialization-retry");
    const response = await ingestPublicationBatch({ payload, principal });

    expect(response.results[0].status).toBe("created");
    expect(fake.prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(fake.state.batches.size).toBe(1);
    expect(fake.state.publications.size).toBe(1);
  });

  it("bounds repeated serialization conflicts", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("Write conflict", {
      code: "P2034",
      clientVersion: "test",
    });
    for (
      let attempt = 0;
      attempt < PUBLICATION_INGESTION_TRANSACTION_MAX_ATTEMPTS;
      attempt += 1
    ) {
      fake.prisma.$transaction.mockRejectedValueOnce(error);
    }
    await expect(
      ingestPublicationBatch({
        payload: payloadFor({}, "batch-serialization-exhausted"),
        principal,
      }),
    ).rejects.toBe(error);
    expect(fake.prisma.$transaction).toHaveBeenCalledTimes(
      PUBLICATION_INGESTION_TRANSACTION_MAX_ATTEMPTS,
    );
  });

  it("does not retry non-transient transaction failures", async () => {
    fake.prisma.$transaction.mockImplementationOnce(() =>
      Promise.reject(uniqueViolationError()),
    );

    const payload = payloadFor({}, "batch-non-transient-failure");
    await expect(
      ingestPublicationBatch({ payload, principal }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);

    expect(fake.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("resolves a committed batch through the unique-violation re-read without retrying", async () => {
    const payload = payloadFor({}, "batch-committed-race");
    const committed = await ingestPublicationBatch({ payload, principal });

    fake.prisma.$transaction.mockImplementationOnce(() =>
      Promise.reject(uniqueViolationError()),
    );
    const replayed = await ingestPublicationBatch({ payload, principal });

    expect(replayed).toEqual(committed);
    expect(fake.prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(fake.state.batches.size).toBe(1);
  });
});

describe("publication ingestion unchanged redelivery", () => {
  beforeEach(() => fake.clear());

  const bodyObject = {
    kind: "body_html" as const,
    sha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    size: 4,
    contentType: "text/html",
  };

  it("re-registers the claim and flags missing object bytes on an unchanged redelivery", async () => {
    const first = await ingestPublicationBatch({
      payload: payloadFor(
        { objects: [bodyObject] },
        "batch-redelivery-initial",
      ),
      principal,
    });
    expect(first.results[0].status).toBe("created");
    expect(fake.state.claims.size).toBe(1);

    const second = await ingestPublicationBatch({
      payload: payloadFor({ objects: [bodyObject] }, "batch-redelivery-retry"),
      principal,
    });

    expect(second.results[0].status).toBe("unchanged");
    expect(second.results[0].objectsNeedingUpload).toEqual([
      { kind: bodyObject.kind, sha256: bodyObject.sha256 },
    ]);
    expect(() =>
      publicationIngestionBatchResponseSchema.parse(second),
    ).not.toThrow();
    // The retry batch owns a claim so the object plan endpoint accepts its
    // batchId, while the revision keeps a single object link.
    expect(fake.state.claims.size).toBe(2);
    expect(fake.state.links.size).toBe(1);
    const claimBatchIds = [...fake.state.claims.values()].map((claim) =>
      String(claim.batchId),
    );
    expect(new Set(claimBatchIds).size).toBe(2);
  });

  it("does not flag an unchanged object whose bytes are already linked", async () => {
    await ingestPublicationBatch({
      payload: payloadFor({ objects: [bodyObject] }, "batch-linked-initial"),
      principal,
    });
    for (const object of fake.state.objects.values()) {
      object.status = "linked";
    }

    const second = await ingestPublicationBatch({
      payload: payloadFor({ objects: [bodyObject] }, "batch-linked-retry"),
      principal,
    });

    expect(second.results[0].status).toBe("unchanged");
    expect(second.results[0]).not.toHaveProperty("objectsNeedingUpload");
    expect(fake.state.claims.size).toBe(2);
  });

  it("keeps repeated unchanged redeliveries idempotent", async () => {
    await ingestPublicationBatch({
      payload: payloadFor({ objects: [bodyObject] }, "batch-repeat-1"),
      principal,
    });
    const second = await ingestPublicationBatch({
      payload: payloadFor({ objects: [bodyObject] }, "batch-repeat-2"),
      principal,
    });
    const third = await ingestPublicationBatch({
      payload: payloadFor({ objects: [bodyObject] }, "batch-repeat-3"),
      principal,
    });

    expect(second.results[0].status).toBe("unchanged");
    expect(third.results[0].status).toBe("unchanged");
    expect(third.results[0].objectsNeedingUpload).toEqual([
      { kind: bodyObject.kind, sha256: bodyObject.sha256 },
    ]);
    expect(fake.state.objects.size).toBe(1);
    expect(fake.state.revisions.size).toBe(1);
    expect(fake.state.links.size).toBe(1);
    expect(fake.state.claims.size).toBe(3);
  });
});
