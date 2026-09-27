import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { ingestPublicationBatch } from "@/features/publications/server/publication-ingestion-service";
import {
  type CloudflareR2Bucket,
  runWithCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";
import {
  postPublicationObjectPlanRoute,
  putPublicationObjectRoute,
} from "@/lib/api/routes/publication-ingestion-routes";
import { getPublicPublicationObjectRoute } from "@/lib/api/routes/publication-public-routes";
import { publicationIngestionBatchRequestSchema } from "@/lib/api/schemas/request-publication-ingestion-schemas";
import { PUBLICATION_INGESTION_SERVICE_PRINCIPAL as principal } from "@/lib/auth/service-principal";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const secret = `object-contract-${marker}`;
const sources: string[] = [];
const batches: string[] = [];
const hashes: string[] = [];
let directory: string;
let bucket: CloudflareR2Bucket;
let platform: PlatformProxy<{ R2_PUBLICATIONS: CloudflareR2Bucket }>;
const origin = "https://life.example";
const auth = { "X-Publication-Ingestion-Secret": secret };
async function fixture(label: string, contentType = "text/markdown") {
  const bytes = new TextEncoder().encode(`# Publication ${marker} ${label}`);
  const sha256 = Buffer.from(
    await crypto.subtle.digest("SHA-256", bytes),
  ).toString("hex");
  hashes.push(sha256);
  const sourceId = `obj-${crypto.randomUUID()}`;
  sources.push(sourceId);
  const batchId = `${marker}-${label}`;
  const object = {
    kind: "body_markdown" as const,
    sha256,
    size: bytes.byteLength,
    contentType,
  };
  const payload = publicationIngestionBatchRequestSchema.parse({
    protocolVersion: "1",
    producerVersion: "integration-test",
    clientRunId: batchId,
    batchId,
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
        canonicalUrl: `https://publication.example/${batchId}`,
        revisionHash: "a".repeat(64),
        observedAt: "2026-09-01",
        publicationType: "news",
        title: label,
        bodyText: "Never use bodyText as Markdown",
        objects: [object],
      },
    ],
  });
  const response = await ingest(payload);
  const publicationId = response.results[0].publicationId!;
  return {
    payload,
    object,
    bytes,
    publicationId,
    key: `publications/body_markdown/sha256/${sha256.slice(0, 2)}/${sha256}`,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function ingest(
  payload: ReturnType<typeof publicationIngestionBatchRequestSchema.parse>,
) {
  batches.push(payload.batchId);
  return ingestPublicationBatch({ payload, principal });
}
function runtime<T>(callback: () => T | Promise<T>) {
  return runWithCloudflareRuntimeEnv(
    {
      R2_PUBLICATIONS: bucket,
      HYPERDRIVE: { connectionString: process.env.DATABASE_URL },
    },
    callback,
  );
}
async function plan(
  f: Fixture,
  batchId = f.payload.batchId,
  headers: Record<string, string> = auth,
) {
  return runtime(() =>
    postPublicationObjectPlanRoute(
      new Request(`${origin}/api/ingestion/publications/objects/plan`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({
          batchId,
          objects: [{ kind: f.object.kind, sha256: f.object.sha256 }],
        }),
      }),
    ),
  );
}
async function upload(
  f: Fixture,
  options: {
    batchId?: string;
    headers?: Record<string, string>;
    bytes?: Uint8Array;
  } = {},
) {
  const batchId = options.batchId ?? f.payload.batchId;
  const bytes = options.bytes ?? f.bytes;
  return runtime(() =>
    putPublicationObjectRoute(
      new Request(
        `${origin}/api/ingestion/publications/objects/${batchId}/${f.object.kind}/${f.object.sha256}`,
        {
          method: "PUT",
          headers: {
            ...auth,
            "content-length": String(bytes.byteLength),
            "content-type": f.object.contentType,
            ...options.headers,
          },
          body: Buffer.from(bytes),
        },
      ),
      { batchId, kind: f.object.kind, sha256: f.object.sha256 },
    ),
  );
}
async function read(f: Fixture, headers: Record<string, string> = {}) {
  return runtime(() =>
    getPublicPublicationObjectRoute(
      new Request(
        `${origin}/api/publications/objects/${f.object.kind}/${f.object.sha256}`,
        { headers },
      ),
      { kind: f.object.kind, sha256: f.object.sha256 },
    ),
  );
}
async function objectRow(f: Fixture) {
  return db.publicationObject.findUniqueOrThrow({
    where: { kind_sha256: { kind: f.object.kind, sha256: f.object.sha256 } },
  });
}
beforeAll(async () => {
  vi.stubEnv("PUBLICATION_INGESTION_SECRET", secret);
  directory = await mkdtemp(join(tmpdir(), "publication-r2-contract-"));
  const configPath = join(directory, "wrangler.json");
  await writeFile(
    configPath,
    JSON.stringify({
      name: "publication-object-contracts",
      compatibility_date: "2026-09-01",
      r2_buckets: [
        { binding: "R2_PUBLICATIONS", bucket_name: "publication-contracts" },
      ],
    }),
  );
  platform = await getPlatformProxy({
    configPath,
    persist: false,
    remoteBindings: false,
    envFiles: [],
  });
  const actual = platform.env.R2_PUBLICATIONS;
  // getPlatformProxy cannot preserve a Node stream's known length in workerd.
  // Materialize only this test's tiny fixture bodies across that transport;
  // R2 itself still performs the real checksum, storage, metadata and read work.
  bucket = {
    delete: (key) => actual.delete(key),
    get: (key) => actual.get(key),
    head: (key) => actual.head(key),
    put: async (key, value, options) =>
      actual.put(
        key,
        value instanceof ReadableStream
          ? await new Response(value).arrayBuffer()
          : value,
        options,
      ),
  };
});
afterAll(async () => {
  await platform?.dispose();
  if (directory) await rm(directory, { recursive: true, force: true });
  const publications = await db.publication.findMany({
    where: { sourceId: { in: sources } },
    select: { id: true },
  });
  await db.publicationEventOutbox.deleteMany({
    where: { aggregateId: { in: publications.map((p) => p.id) } },
  });
  await db.publicationSource.deleteMany({ where: { id: { in: sources } } });
  await db.ingestionBatch.deleteMany({ where: { batchId: { in: batches } } });
  await db.ingestionRun.deleteMany({
    where: { clientRunId: { startsWith: marker } },
  });
  await db.publicationObject.deleteMany({ where: { sha256: { in: hashes } } });
  await db.$disconnect();
  vi.unstubAllEnvs();
});

it("publications.objects", async () => {
  const f = await fixture("objects");
  expect(await objectRow(f)).toMatchObject({
    r2Key: f.key,
    status: "pending",
    verifiedAt: null,
  });
  expect(await platform.env.R2_PUBLICATIONS.head(f.key)).toBeNull();
  expect(await (await plan(f)).json()).toMatchObject({
    objects: [{ status: "upload_required", r2Key: f.key }],
  });
  const unrelated = await fixture("unrelated");
  expect((await plan(f, unrelated.payload.batchId)).status).toBe(404);
  expect((await upload(f, { batchId: unrelated.payload.batchId })).status).toBe(
    404,
  );
  expect((await plan(f, "missing-batch")).status).toBe(404);
  expect((await upload(f, { bytes: f.bytes.slice(1) })).status).toBe(400);
  expect(
    (await upload(f, { bytes: new Uint8Array(f.bytes.length).fill(65) }))
      .status,
  ).toBe(503);
  expect((await objectRow(f)).status).toBe("pending");
  expect(await platform.env.R2_PUBLICATIONS.head(f.key)).toBeNull();
  expect((await upload(f)).status).toBe(200);
  const stored = await platform.env.R2_PUBLICATIONS.get(f.key);
  expect(stored).toMatchObject({
    size: f.bytes.length,
    httpMetadata: { contentType: f.object.contentType },
    customMetadata: { kind: f.object.kind, sha256: f.object.sha256 },
  });
  expect(
    new Uint8Array(await new Response(stored!.body).arrayBuffer()),
  ).toEqual(f.bytes);
  expect(await objectRow(f)).toMatchObject({
    status: "linked",
    verifiedAt: expect.any(Date),
    lastError: null,
  });
  expect(await (await plan(f)).json()).toMatchObject({
    objects: [{ status: "already_present", uploadUrl: null }],
  });
});

it("publications.required-upload-headers", async () => {
  const f = await fixture("headers");
  expect((await plan(f, f.payload.batchId, {})).status).toBe(401);
  const response = await plan(f);
  const value = await response.json();
  expect(value).toEqual({
    batchId: f.payload.batchId,
    objects: [
      {
        kind: f.object.kind,
        sha256: f.object.sha256,
        r2Key: f.key,
        status: "upload_required",
        uploadUrl: `${origin}/api/ingestion/publications/objects/${f.payload.batchId}/${f.object.kind}/${f.object.sha256}`,
        requiredHeaders: { "Content-Type": "text/markdown" },
      },
    ],
  });
  expect(JSON.stringify(value)).not.toContain(secret);
  for (const type of ["", "text/plain", "text/markdown; charset=utf-8"]) {
    expect(
      (await upload(f, { headers: { "content-type": type } })).status,
    ).toBe(400);
    expect(await platform.env.R2_PUBLICATIONS.head(f.key)).toBeNull();
  }
  expect(
    (
      await upload(f, {
        headers: { "X-Publication-Ingestion-Secret": "wrong" },
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await upload(f, {
        headers: {
          "x-amz-meta-kind": "asset",
          "x-amz-meta-sha256": "0".repeat(64),
          "x-amz-meta-key": "caller-selected-key",
        },
      })
    ).status,
  ).toBe(200);
  expect(
    await platform.env.R2_PUBLICATIONS.head("caller-selected-key"),
  ).toBeNull();
  expect(await platform.env.R2_PUBLICATIONS.head(f.key)).toMatchObject({
    customMetadata: { kind: f.object.kind, sha256: f.object.sha256 },
  });
});

it("publications.unchanged-objects", async () => {
  const f = await fixture("unchanged");
  const replay = { ...f.payload, batchId: `${f.payload.batchId}-retry` };
  const result = await ingest(replay);
  expect(result.results[0]).toMatchObject({
    status: "unchanged",
    objectsNeedingUpload: [{ kind: f.object.kind, sha256: f.object.sha256 }],
  });
  expect(await (await plan(f, replay.batchId)).json()).toMatchObject({
    objects: [{ status: "upload_required" }],
  });
  expect((await upload(f, { batchId: replay.batchId })).status).toBe(200);
  const verified = await ingest({
    ...f.payload,
    batchId: `${f.payload.batchId}-verified`,
  });
  expect(verified.results[0].status).toBe("unchanged");
  expect(verified.results[0]).not.toHaveProperty("objectsNeedingUpload");
  expect(
    await db.publicationRevision.count({
      where: { publicationId: f.publicationId },
    }),
  ).toBe(1);
  expect(
    await db.ingestionBatchObject.count({
      where: { objectId: (await objectRow(f)).id },
    }),
  ).toBe(3);
});

it("publications.content-type", async () => {
  const f = await fixture("content-type", "text/plain");
  const item = f.payload.items[0];
  if (item.tombstone) throw new Error("Expected live revision");
  const alias = {
    ...f.payload,
    batchId: `${f.payload.batchId}-alias`,
    items: [
      { ...item, objects: [{ ...f.object, contentType: "text/markdown" }] },
    ],
  };
  expect((await ingest(alias)).results[0].status).toBe("unchanged");
  const initial = await objectRow(f);
  expect(initial).toMatchObject({
    contentType: "text/plain",
    size: f.bytes.length,
    r2Key: f.key,
  });
  expect(await (await plan(f, alias.batchId)).json()).toMatchObject({
    objects: [{ requiredHeaders: { "Content-Type": "text/plain" } }],
  });
  expect(
    (
      await upload(f, {
        batchId: alias.batchId,
        headers: { "content-type": "text/markdown" },
      })
    ).status,
  ).toBe(400);
  for (const status of ["pending", "linked"] as const) {
    if (status === "linked")
      expect((await upload(f, { batchId: alias.batchId })).status).toBe(200);
    const conflict = {
      ...alias,
      batchId: `${f.payload.batchId}-size-${status}`,
      items: [
        {
          ...item,
          revisionHash: "b".repeat(64),
          objects: [
            {
              ...f.object,
              size: f.bytes.length + 1,
              contentType: "application/octet-stream",
            },
          ],
        },
      ],
    };
    await expect(ingest(conflict)).rejects.toThrow(
      "Object manifest does not match",
    );
    expect(await objectRow(f)).toMatchObject({
      contentType: initial.contentType,
      size: initial.size,
      r2Key: initial.r2Key,
    });
  }
  const publicRead = await read(f);
  expect(publicRead.headers.get("content-type")).toBe("text/plain");
  expect(await publicRead.text()).toBe(new TextDecoder().decode(f.bytes));
  expect(
    await db.publicationRevision.count({
      where: { publicationId: f.publicationId },
    }),
  ).toBe(1);
});

it("publications.public-object-read", async () => {
  const f = await fixture("public-read");
  expect((await read(f)).status).toBe(404);
  expect((await upload(f)).status).toBe(200);
  expect((await read(f)).status).toBe(200);
  const object = await objectRow(f);
  const publication = await db.publication.findUniqueOrThrow({
    where: { id: f.publicationId },
  });
  const revisionId = publication.currentRevisionId!;
  for (const change of [
    { status: "pending" as const },
    { status: "failed" as const },
    { r2Key: "noncanonical-key" },
  ]) {
    await db.publicationObject.update({
      where: { id: object.id },
      data: change,
    });
    expect((await read(f, { "If-None-Match": "*" })).status).toBe(404);
    await db.publicationObject.update({
      where: { id: object.id },
      data: { status: "linked", r2Key: f.key },
    });
  }
  for (const change of [
    { deletedAt: new Date() },
    { publicationType: "other" as const },
    { currentRevisionId: null },
  ]) {
    await db.publication.update({
      where: { id: f.publicationId },
      data: change,
    });
    expect((await read(f)).status).toBe(404);
    await db.publication.update({
      where: { id: f.publicationId },
      data: {
        deletedAt: null,
        publicationType: "news",
        currentRevisionId: revisionId,
      },
    });
  }
  for (const change of [
    { isTombstone: true },
    { publicationType: "other" as const },
  ]) {
    await db.publicationRevision.update({
      where: { id: revisionId },
      data: change,
    });
    expect((await read(f)).status).toBe(404);
    await db.publicationRevision.update({
      where: { id: revisionId },
      data: { isTombstone: false, publicationType: "news" },
    });
  }
  await platform.env.R2_PUBLICATIONS.delete(f.key);
  expect((await read(f, { "If-None-Match": "*" })).status).toBe(404);
  await platform.env.R2_PUBLICATIONS.put(f.key, "wrong-size", {
    httpMetadata: { contentType: f.object.contentType },
  });
  expect((await read(f)).status).toBe(404);
  await platform.env.R2_PUBLICATIONS.put(f.key, f.bytes, {
    httpMetadata: { contentType: "text/html" },
  });
  expect((await read(f)).status).toBe(404);
});

it("publications.object-cache-revalidation", async () => {
  const f = await fixture("cache-revalidation");
  expect((await upload(f)).status).toBe(200);
  const first = await read(f);
  expect(first.status).toBe(200);
  const etag = first.headers.get("etag");
  expect(etag).toBeTruthy();
  if (!etag) throw new Error("Missing object ETag");
  expect(await first.text()).toBe(new TextDecoder().decode(f.bytes));
  expect(first.headers.get("cache-control")).toBe(
    "public, no-cache, no-transform",
  );
  expect(first.headers.get("cloudflare-cdn-cache-control")).toBe("no-store");
  const unchanged = await read(f, { "If-None-Match": etag });
  expect(unchanged.status).toBe(304);
  expect(await unchanged.text()).toBe("");
  expect(unchanged.headers.get("etag")).toBe(etag);
  expect(unchanged.headers.get("cache-control")).toBe(
    first.headers.get("cache-control"),
  );
  expect(unchanged.headers.get("cloudflare-cdn-cache-control")).toBe(
    "no-store",
  );
  await db.publication.update({
    where: { id: f.publicationId },
    data: { deletedAt: new Date() },
  });
  const revoked = await read(f, { "If-None-Match": etag });
  expect(revoked.status).toBe(404);
  expect(revoked.headers.get("cache-control")).toBe("private, no-store");
  expect(await revoked.text()).not.toContain(new TextDecoder().decode(f.bytes));
});

it("publications.object-content-disposition", async () => {
  for (const [kind, contentType, disposition] of [
    ["media", "image/png", "inline"],
    ["media", "audio/mpeg", "inline"],
    ["media", "video/mp4", "inline"],
    ["media", "text/html", "attachment"],
    ["body_html", "text/html", "attachment"],
    ["body_markdown", "text/markdown", "attachment"],
    ["raw_page", "text/html", "attachment"],
    ["asset", "application/pdf", "attachment"],
  ] as const) {
    const f = await fixture(
      `disposition-${kind}-${contentType.replace("/", "-")}`,
    );
    const original = await objectRow(f);
    const key = `publications/${kind}/sha256/${f.object.sha256.slice(0, 2)}/${f.object.sha256}`;
    await platform.env.R2_PUBLICATIONS.put(key, f.bytes, {
      httpMetadata: { contentType },
    });
    await db.publicationObject.update({
      where: { id: original.id },
      data: {
        kind,
        r2Key: key,
        contentType,
        status: "verified",
        verifiedAt: new Date(),
      },
    });
    await db.publicationObjectLink.updateMany({
      where: { objectId: original.id },
      data: { role: kind, filename: '../../unsafe"\r\nX-Injected: yes.pdf' },
    });
    const response = await runtime(() =>
      getPublicPublicationObjectRoute(
        new Request(
          `${origin}/api/publications/objects/${kind}/${f.object.sha256}`,
        ),
        { kind, sha256: f.object.sha256 },
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(contentType);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-injected")).toBeNull();
    const filename = `publication-${kind}-${f.object.sha256.slice(0, 16)}${contentType === "application/pdf" ? ".pdf" : ""}`;
    expect(response.headers.get("content-disposition")).toBe(
      disposition === "inline"
        ? "inline"
        : `attachment; filename="${filename}"`,
    );
    expect(await response.text()).toBe(new TextDecoder().decode(f.bytes));
  }
});
