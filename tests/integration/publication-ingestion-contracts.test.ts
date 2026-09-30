import { ingestPublicationBatch } from "@/features/publications/server/publication-ingestion-service";
import { publicationIngestionBatchRequestSchema } from "@/lib/api/schemas/request-publication-ingestion-schemas";
import { PUBLICATION_INGESTION_SERVICE_PRINCIPAL as principal } from "@/lib/auth/service-principal";
import { nodeProtocolTest } from "../shared/node-protocol-fixture";

const it = nodeProtocolTest.extend("publication", async ({ protocolRuntime }) =>
  protocolRuntime.run(() => {
    const marker = crypto.randomUUID();
    function batch(label: string) {
      const sourceId = `contract-${marker.slice(0, 20)}-${label}`;
      return publicationIngestionBatchRequestSchema.parse({
        protocolVersion: "1",
        producerVersion: "integration-test",
        clientRunId: `${marker}-${label}`,
        batchId: `${marker}-${label}`,
        observedAt: "2026-09-01T10:00:00+08:00",
        sources: [
          {
            id: sourceId,
            name: label,
            organizationLevel: "university",
            allowedHosts: ["publication.example"],
            blockedHosts: ["blocked.publication.example"],
          },
        ],
        items: [
          {
            sourceId,
            canonicalUrl: `https://publication.example/${marker}/${label}`,
            revisionHash: "a".repeat(64),
            observedAt: "2026-09-01T10:00:00+08:00",
            publicationType: "news",
            title: label,
            publishedAt: "2026-09-01",
            objects: [],
          },
        ],
      });
    }
    type Batch = ReturnType<typeof batch>;
    async function ingest(payload: Batch) {
      return protocolRuntime.request(() =>
        ingestPublicationBatch({ payload, principal }),
      );
    }
    async function next(
      payload: Batch,
      label: string,
      item: Partial<Batch["items"][number]>,
    ) {
      const merged = { ...payload.items[0], ...item };
      const revision = merged.tombstone
        ? {
            tombstone: true,
            sourceId: merged.sourceId,
            canonicalUrl: merged.canonicalUrl,
            revisionHash: merged.revisionHash,
            observedAt: merged.observedAt,
          }
        : merged;
      return ingest(
        publicationIngestionBatchRequestSchema.parse({
          ...payload,
          batchId: `${payload.batchId}-${label}`,
          items: [revision],
        }),
      );
    }
    return { marker, batch, ingest, next };
  }),
);

it("publications.service-principal", async ({
  publication,
  isolatedDatabase: { owner: db },
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const { marker, batch, ingest } = publication;
    const payload = batch("principal");
    const hash = Buffer.from(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(marker)),
    ).toString("hex");
    if (payload.items[0].tombstone)
      throw new Error("Expected publication item");
    payload.items[0].objects = [
      {
        kind: "body_markdown",
        sha256: hash,
        size: 8,
        contentType: "text/markdown",
      },
    ];
    const result = await ingest(payload);
    expect(result.results[0].status).toBe("created");
    expect(principal).toEqual({
      kind: "service",
      serviceId: "publication-crawler",
      principalKey: "service:publication-crawler",
    });
    const persisted = await db.ingestionBatch.findUniqueOrThrow({
      where: {
        principalKey_batchId: {
          principalKey: principal.principalKey,
          batchId: payload.batchId,
        },
      },
      include: { objects: true },
    });
    expect(persisted.principalId).toBeNull();
    expect(persisted.principalKey).toBe("service:publication-crawler");
    expect(persisted.objects).toHaveLength(1);
    const run = await db.ingestionRun.findUniqueOrThrow({
      where: {
        principalKey_clientRunId: {
          principalKey: principal.principalKey,
          clientRunId: payload.clientRunId,
        },
      },
    });
    expect(run.principalId).toBeNull();
    expect(run.principalKey).toBe(principal.principalKey);
    expect(
      await db.user.findUnique({ where: { id: principal.principalKey } }),
    ).toBeNull();
  });
});

it("publications.revision-ordering", async ({
  publication,
  isolatedDatabase: { owner: db },
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const { batch, ingest, next } = publication;
    const payload = batch("ordering");
    payload.items[0].observedAt = "2026-09-01";
    const first = await ingest(payload);
    const id = first.results[0].publicationId!;
    const original = await db.publicationRevision.findUniqueOrThrow({
      where: { id: first.results[0].revisionId! },
    });
    expect(original.observedAt.toISOString()).toBe("2026-08-31T16:00:00.000Z");
    await next(payload, "newer", {
      title: "newest",
      revisionHash: "b".repeat(64),
      observedAt: "2026-09-03T09:00:00",
    });
    await next(payload, "older", {
      title: "older",
      revisionHash: "f".repeat(64),
      observedAt: "2026-09-02T09:00:00+08:00",
    });
    expect(
      (await db.publication.findUniqueOrThrow({ where: { id } })).title,
    ).toBe("newest");
    await next(payload, "tie-high", {
      title: "tie higher",
      revisionHash: "c".repeat(64),
      observedAt: "2026-09-03T09:00:00+08:00",
    });
    await next(payload, "tie-low", {
      title: "tie lower",
      revisionHash: "1".repeat(64),
      observedAt: "2026-09-03T09:00:00+08:00",
    });
    const current = await db.publication.findUniqueOrThrow({
      where: { id },
      include: { currentRevision: true },
    });
    expect(current.title).toBe("tie higher");
    expect(current.currentRevision?.revisionHash).toBe("c".repeat(64));
    expect(current.currentRevision?.observedAt.toISOString()).toBe(
      "2026-09-03T01:00:00.000Z",
    );
  });
});

it("publications.tombstones", async ({
  publication,
  isolatedDatabase: { owner: db },
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const { batch, ingest, next } = publication;
    const payload = batch("tombstone");
    const unknown = await next(payload, "unknown", { tombstone: true });
    expect(unknown.results[0]).toMatchObject({
      status: "unchanged",
      publicationId: null,
      revisionId: null,
    });
    expect(
      await db.publication.count({
        where: { sourceId: payload.sources[0].id },
      }),
    ).toBe(0);
    const created = await ingest(payload);
    const deleted = await next(payload, "deleted", {
      tombstone: true,
      observedAt: "2026-09-02",
      revisionHash: "b".repeat(64),
    });
    expect(deleted.results[0].status).toBe("updated");
    const record = await db.publication.findUniqueOrThrow({
      where: { id: created.results[0].publicationId! },
      include: { currentRevision: true },
    });
    expect(record.deletedAt).not.toBeNull();
    expect(record.currentRevision?.isTombstone).toBe(true);
  });
});

it("publications.partial-item-rejection", async ({
  publication,
  isolatedDatabase: { owner: db },
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const { batch, ingest } = publication;
    const payload = batch("partial");
    payload.items.push({
      ...payload.items[0],
      canonicalUrl: "https://outside.example/rejected",
      revisionHash: "b".repeat(64),
    });
    const result = await ingest(payload);
    expect(result.results.map((item) => item.status)).toEqual([
      "created",
      "rejected",
    ]);
    expect(
      await db.publication.count({
        where: { sourceId: payload.sources[0].id },
      }),
    ).toBe(1);
    expect(
      await db.publicationRevision.count({
        where: { publicationId: result.results[0].publicationId! },
      }),
    ).toBe(1);
  });
});

it("publications.source-registration", async ({
  publication,
  isolatedDatabase: { owner: db },
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const { marker, batch, ingest } = publication;
    const payload = batch("source");
    expect((await ingest(payload)).results[0].status).toBe("created");
    const sourceId = payload.sources[0].id;
    const minimal = {
      ...payload,
      sources: [{ id: sourceId, name: "renamed" }],
      batchId: `${payload.batchId}-minimal`,
      items: [
        {
          ...payload.items[0],
          canonicalUrl: `https://publication.example/${marker}/minimal`,
        },
      ],
    };
    expect((await ingest(minimal)).results[0].status).toBe("created");
    expect(
      await db.publicationSource.findUniqueOrThrow({ where: { id: sourceId } }),
    ).toMatchObject({
      name: "renamed",
      organizationLevel: "university",
      allowedHosts: ["publication.example"],
      blockedHosts: ["blocked.publication.example"],
    });
    for (const [label, canonicalUrl] of [
      ["blocked", "https://blocked.publication.example/article"],
      ["outside", "https://outside.example/article"],
    ]) {
      const result = await ingest({
        ...minimal,
        batchId: `${payload.batchId}-${label}`,
        items: [{ ...payload.items[0], canonicalUrl }],
      });
      expect(result.results[0].status).toBe("rejected");
    }
    await db.publicationSource.update({
      where: { id: sourceId },
      data: { enabled: false },
    });
    expect(
      (await ingest({ ...minimal, batchId: `${payload.batchId}-disabled` }))
        .results[0].status,
    ).toBe("rejected");
    await db.publicationSource.update({
      where: { id: sourceId },
      data: { enabled: true, discoveryOnly: true },
    });
    expect(
      (await ingest({ ...minimal, batchId: `${payload.batchId}-discovery` }))
        .results[0].status,
    ).toBe("rejected");
  });
});

it("publications.reprint-fold-title-normalization", async ({
  publication,
  isolatedDatabase: { owner: db },
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const { batch, ingest } = publication;
    const payload = batch("title-normalization");
    const cases: Array<[string, string]> = [
      ["  Campus   Update  ", "campus update"],
      ["ＵＳＴＣ２０２６年度报告", "ustc2026年度报告"],
      ["通知（重要）", "通知(重要)"],
      ["中国科学技术大学\u3000通知", "中国科学技术大学 通知"],
      ["Campus\u00a0Update", "campus update"],
      ["Cam\u200bpus\u200c\u200d\u2060Update\ufeff", "campusupdate"],
      ["Cam\u00adpus", "campus"],
      ["《规划纲要》发布", "《规划纲要》发布"],
      ["〈规划纲要〉发布", "〈规划纲要〉发布"],
      ["重要通知（一）", "重要通知(一)"],
      ["重要通知（二）", "重要通知(二)"],
    ];
    payload.items = cases.map(([title], index) => ({
      ...payload.items[0],
      title,
      canonicalUrl: `${payload.items[0].canonicalUrl}/${index}`,
    }));
    const result = await ingest(payload);
    expect(result.results.every((item) => item.status === "created")).toBe(
      true,
    );
    for (const [index, [, key]] of cases.entries()) {
      const row = await db.publication.findUniqueOrThrow({
        where: { id: result.results[index].publicationId! },
        select: { normalizedTitle: true },
      });
      expect(row.normalizedTitle).toBe(key);
    }
  });
});
