import { beforeEach, describe, expect, it, vi } from "vitest";
import { publicationIngestionBatchRequestSchema } from "@/lib/api/schemas/request-publication-ingestion-schemas";
import { PUBLICATION_INGESTION_SERVICE_PRINCIPAL } from "@/lib/auth/service-principal";
import fixture from "../../docs/contracts/fixtures/publication-batch.json";

type QueryArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
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
      findUnique: vi.fn(async (args: QueryArgs) => {
        const where = value<{
          sourceId_canonicalUrl: { sourceId: string; canonicalUrl: string };
        }>(args.where);
        const publication = [...state.publications.values()].find(
          (entry) =>
            entry.sourceId === where.sourceId_canonicalUrl.sourceId &&
            entry.canonicalUrl === where.sourceId_canonicalUrl.canonicalUrl,
        );
        if (!publication) return null;
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
      findUnique: vi.fn(async (args: QueryArgs) => {
        const where = value<{
          publicationId_revisionHash: {
            publicationId: string;
            revisionHash: string;
          };
        }>(args.where);
        const revision = [...state.revisions.values()].find(
          (entry) =>
            entry.publicationId ===
              where.publicationId_revisionHash.publicationId &&
            entry.revisionHash ===
              where.publicationId_revisionHash.revisionHash,
        );
        if (!revision) return null;
        return {
          ...revision,
          objectLinks: [...state.links.values()]
            .filter((link) => link.revisionId === revision.id)
            .map((link) => ({
              altText: (link.altText as string | null | undefined) ?? null,
              object: state.objects.get(String(link.objectId)) ?? null,
              role: String(link.role),
              sortOrder: (link.sortOrder as number | null | undefined) ?? null,
            })),
        };
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
    publicationObject: {
      upsert: vi.fn(),
    },
    ingestionBatchObject: {
      upsert: vi.fn(),
    },
    publicationObjectLink: {
      upsert: vi.fn(),
    },
    publicationEventOutbox: {
      upsert: vi.fn(),
    },
  };

  tx.publicationObject.upsert.mockImplementation(async (args: QueryArgs) => {
    const where = value<{ kind_sha256: { kind: string; sha256: string } }>(
      args.where,
    );
    const key = `${where.kind_sha256.kind}:${where.kind_sha256.sha256}`;
    const existing = state.objects.get(key);
    if (existing) return existing;
    const created = {
      id: id("object"),
      status: "pending",
      ...objectValue(args.create),
    };
    state.objects.set(key, created);
    return created;
  });

  tx.ingestionBatchObject.upsert.mockImplementation(async (args: QueryArgs) => {
    const where = value<{
      batchId_objectId: { batchId: string; objectId: string };
    }>(args.where);
    const key = `${where.batchId_objectId.batchId}:${where.batchId_objectId.objectId}`;
    const existing = state.claims.get(key);
    if (existing) {
      Object.assign(existing, args.update);
      return existing;
    }
    const created = { id: id("claim"), ...objectValue(args.create) };
    state.claims.set(key, created);
    return created;
  });

  tx.publicationObjectLink.upsert.mockImplementation(
    async (args: QueryArgs) => {
      const where = value<{
        revisionId_objectId_role: {
          revisionId: string;
          objectId: string;
          role: string;
        };
      }>(args.where);
      const key = `${where.revisionId_objectId_role.revisionId}:${where.revisionId_objectId_role.objectId}:${where.revisionId_objectId_role.role}`;
      const existing = state.links.get(key);
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      const created = { id: id("link"), ...objectValue(args.create) };
      state.links.set(key, created);
      return created;
    },
  );

  tx.publicationEventOutbox.upsert.mockImplementation(
    async (args: QueryArgs) => {
      const where = value<{ eventId: string }>(args.where);
      const existing = state.events.get(where.eventId);
      if (existing) return existing;
      const created = { id: id("event"), ...objectValue(args.create) };
      state.events.set(where.eventId, created);
      return created;
    },
  );

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

import {
  ingestPublicationBatch,
  PublicationIngestionBadRequestError,
} from "@/features/publications/server/publication-ingestion-service";

const parsedFixture = publicationIngestionBatchRequestSchema.parse(fixture);
const principal = PUBLICATION_INGESTION_SERVICE_PRINCIPAL;

function payloadFor(item: Record<string, unknown>, batchId: string) {
  return publicationIngestionBatchRequestSchema.parse({
    ...parsedFixture,
    batchId,
    clientRunId: "run-1",
    items: [{ ...parsedFixture.items[0], ...item }],
  });
}

describe("publication ingestion transaction", () => {
  beforeEach(() => fake.clear());

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
      expect(publication?.bodyText).toBe("Original body");
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
});
