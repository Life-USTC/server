import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { ingestPublicationBatch } from "@/features/publications/server/publication-ingestion-service";
import {
  runWithCloudflareRuntimeEnv,
  type CloudflareR2Bucket,
} from "@/lib/adapters/cloudflare-runtime";
import {
  postPublicationObjectPlanRoute,
  putPublicationObjectRoute,
} from "@/lib/api/routes/publication-ingestion-routes";
import {
  getPublicPublicationObjectRoute,
  getPublicPublicationImageRoute,
} from "@/lib/api/routes/publication-public-routes";
import {
  getPublicPublicationById,
  listPublications,
} from "@/features/publications/server/publication-public-read-service";
import { publicationImageR2Key } from "@/features/publications/server/publication-image-service";
import { publicationIngestionBatchRequestSchema } from "@/lib/api/schemas/request-publication-ingestion-schemas";
import { PUBLICATION_INGESTION_SERVICE_PRINCIPAL as principal } from "@/lib/auth/service-principal";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const secret = `object-contract-${marker}`;
const sources: string[] = [];
const batches: string[] = [];
const hashes: string[] = [];
const imageHashes: string[] = [];
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
  await db.publicationImageSource.deleteMany({
    where: { id: { in: imageHashes } },
  });
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

async function registerImage(f: Fixture, url: string) {
  const hash = Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url)),
  ).toString("hex");
  imageHashes.push(hash);
  const item = f.payload.items[0];
  if (item.tombstone) throw new Error("Expected live revision");
  await ingest({
    ...f.payload,
    batchId: `${f.payload.batchId}-image`,
    items: [
      {
        ...item,
        revisionHash: "b".repeat(64),
        observedAt: "2026-09-02",
        imageSources: { [hash]: url },
        imageMetadata: {
          [hash]: { altText: "Alt", title: "Title", caption: "Caption" },
        },
      },
    ],
  });
  return { hash, url, key: publicationImageR2Key(hash) };
}
function imageRead(hash: string, headers: Record<string, string> = {}) {
  return runtime(() =>
    getPublicPublicationImageRoute(
      new Request(`${origin}/api/publications/images/${hash}`, { headers }),
      { hash },
    ),
  );
}

it("publications.publication-markdown", async () => {
  const f = await fixture("markdown");
  const detail = () => runtime(() => getPublicPublicationById(f.publicationId));
  expect((await detail())?.revision).toMatchObject({
    bodyMarkdown: null,
    bodyText: "Never use bodyText as Markdown",
  });
  expect((await upload(f)).status).toBe(200);
  expect((await detail())?.revision.bodyMarkdown).toBe(
    new TextDecoder().decode(f.bytes),
  );
  const listed = await runtime(() =>
    listPublications({ filters: { source: [f.payload.sources[0].id] } }),
  );
  expect(listed.data[0].revision).not.toHaveProperty("bodyText");
  expect(listed.data[0].revision).not.toHaveProperty("bodyMarkdown");
  expect(listed.data[0].revision).not.toHaveProperty("rawMetadata");
  const image = await registerImage(
    f,
    `https://publication.example/${marker}/markdown.png`,
  );
  expect((await detail())?.revision.images).toEqual([
    {
      id: image.hash,
      url: `/api/publications/images/${image.hash}`,
      altText: "Alt",
      title: "Title",
      caption: "Caption",
    },
  ]);
  await platform.env.R2_PUBLICATIONS.delete(f.key);
  expect((await detail())?.revision.bodyMarkdown).toBeNull();
  await platform.env.R2_PUBLICATIONS.put(f.key, "Wrong size", {
    httpMetadata: { contentType: f.object.contentType },
  });
  expect((await detail())?.revision.bodyMarkdown).toBeNull();
  await platform.env.R2_PUBLICATIONS.put(f.key, f.bytes, {
    httpMetadata: { contentType: "text/html" },
  });
  expect((await detail())?.revision.bodyMarkdown).toBeNull();
  const item = f.payload.items[0];
  if (item.tombstone) throw new Error("Expected live revision");
  await ingest({
    ...f.payload,
    batchId: `${f.payload.batchId}-html`,
    items: [
      {
        ...item,
        revisionHash: "c".repeat(64),
        observedAt: "2026-09-03",
        objects: [{ ...f.object, kind: "body_html", contentType: "text/html" }],
      },
    ],
  });
  const html = await db.publicationObject.findUniqueOrThrow({
    where: { kind_sha256: { kind: "body_html", sha256: f.object.sha256 } },
  });
  await platform.env.R2_PUBLICATIONS.put(html.r2Key, "<h1>Archived only</h1>");
  await db.publicationObject.update({
    where: { id: html.id },
    data: { status: "linked" },
  });
  expect((await detail())?.revision.bodyMarkdown).toBeNull();
  expect(
    await db.publicationObject.findUnique({ where: { id: html.id } }),
  ).not.toBeNull();
});

it("publications.publication-images", async () => {
  const f = await fixture("image-registry");
  const url = `https://cdn.example/${marker}/image.png?Width=200`;
  const image = await registerImage(f, url);
  expect(
    await db.publicationImageSource.findUnique({ where: { id: image.hash } }),
  ).toMatchObject({ url });
  await platform.env.R2_PUBLICATIONS.put(image.key, new Uint8Array([1, 2, 3]), {
    httpMetadata: { contentType: "image/png" },
  });
  expect((await imageRead(image.hash)).status).toBe(200);
  const wrongHash = Buffer.from(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(url.toLowerCase()),
    ),
  ).toString("hex");
  expect((await imageRead(wrongHash)).status).toBe(404);
  const item = f.payload.items[0];
  if (item.tombstone) throw new Error("Expected live revision");
  await expect(
    ingest({
      ...f.payload,
      batchId: `${f.payload.batchId}-bad-hash`,
      items: [
        {
          ...item,
          revisionHash: "c".repeat(64),
          observedAt: "2026-09-03",
          imageSources: { [wrongHash]: url },
        },
      ],
    }),
  ).rejects.toThrow("Image source key does not match");
  expect(
    await db.publicationImageSource.findUnique({ where: { id: wrongHash } }),
  ).toBeNull();
  await ingest({
    ...f.payload,
    batchId: `${f.payload.batchId}-new-current`,
    items: [
      { ...item, revisionHash: "d".repeat(64), observedAt: "2026-09-04" },
    ],
  });
  expect((await imageRead(image.hash, { "If-None-Match": "*" })).status).toBe(
    404,
  );
  expect(await platform.env.R2_PUBLICATIONS.head(image.key)).not.toBeNull();
});

it("publications.image-origin-policy", async () => {
  const requested: string[] = [];
  let redirectTo: string | undefined;
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) => {
      const url = String(input);
      requested.push(url);
      if (redirectTo && url.includes("/start.png"))
        return new Response(null, {
          status: 302,
          headers: { Location: redirectTo },
        });
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "Content-Type": "image/png" },
      });
    });
  try {
    const rejected = [
      "http://127.0.0.1/a.png",
      "http://[::1]/a.png",
      "https://localhost/a.png",
      "https://node.internal/a.png",
      "https://user:pass@cdn.example/a.png",
      "https://cdn.example:444/a.png",
      "ftp://cdn.example/a.png",
      "https://blocked.publication.example/a.png",
    ];
    for (const [index, url] of rejected.entries()) {
      const f = await fixture(`origin-reject-${index}`);
      await db.publicationSource.update({
        where: { id: f.payload.sources[0].id },
        data: { blockedHosts: ["blocked.publication.example"] },
      });
      const img = await registerImage(f, url);
      expect((await imageRead(img.hash)).status).toBe(404);
      expect(requested).toHaveLength(0);
      expect(await platform.env.R2_PUBLICATIONS.head(img.key)).toBeNull();
    }
    for (const [index, target] of [
      "https://cdn.example/accepted.png",
      "https://news.ustc.edu.cn/accepted.png",
      "https://sub.publication.example/accepted.png",
      "https://sub.cdn.example/rejected.png",
      "https://blocked.publication.example/rejected.png",
      "http://127.0.0.1/rejected.png",
    ].entries()) {
      const f = await fixture(`redirect-${index}`);
      await db.publicationSource.update({
        where: { id: f.payload.sources[0].id },
        data: { blockedHosts: ["blocked.publication.example"] },
      });
      const img = await registerImage(
        f,
        `https://cdn.example/${marker}/${index}/start.png`,
      );
      redirectTo = target;
      requested.length = 0;
      const response = await imageRead(img.hash);
      expect(response.status).toBe(index < 3 ? 200 : 502);
      expect(requested).toEqual(index < 3 ? [img.url, target] : [img.url]);
      if (index >= 3)
        expect(response.headers.get("cache-control")).toBe("no-store");
    }
  } finally {
    fetchSpy.mockRestore();
  }
});

it("publications.image-response-validation", async () => {
  let responseFactory: () => Response;
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => responseFactory());
  try {
    const limit = 10 * 1024 * 1024;
    let cancelled = false;
    let streamed = 0;
    const invalidResponses: Array<() => Response> = [
      () =>
        new Response("<svg/>", {
          headers: { "Content-Type": "image/svg+xml" },
        }),
      () =>
        new Response("<html/>", { headers: { "Content-Type": "text/html" } }),
      () =>
        new Response(new Uint8Array(0), {
          headers: { "Content-Type": "image/png" },
        }),
      () => new Response("missing", { status: 404 }),
      () =>
        new Response(new Uint8Array([1]), {
          headers: {
            "Content-Type": "image/png",
            "Content-Length": String(limit + 1),
          },
        }),
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              streamed += 64 * 1024;
              controller.enqueue(new Uint8Array(64 * 1024));
            },
            cancel() {
              cancelled = true;
            },
          }),
          { headers: { "Content-Type": "image/png" } },
        ),
    ];
    for (const [index, makeResponse] of invalidResponses.entries()) {
      const f = await fixture(`response-${index}`);
      const img = await registerImage(
        f,
        `https://cdn.example/${marker}/response-${index}.png`,
      );
      responseFactory = makeResponse;
      const response = await imageRead(img.hash);
      expect(response.status).toBe(502);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await platform.env.R2_PUBLICATIONS.head(img.key)).toBeNull();
    }
    expect(cancelled).toBe(true);
    expect(streamed).toBeLessThanOrEqual(limit + 2 * 64 * 1024);
    const f = await fixture("response-boundary");
    const img = await registerImage(
      f,
      `https://cdn.example/${marker}/boundary.png`,
    );
    responseFactory = () =>
      new Response(new Uint8Array(limit), {
        headers: { "Content-Type": "image/png" },
      });
    const response = await imageRead(img.hash);
    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBe(limit);
    expect((await platform.env.R2_PUBLICATIONS.head(img.key))?.size).toBe(
      limit,
    );
  } finally {
    fetchSpy.mockRestore();
  }
});

it("publications.image-archive", async () => {
  const f = await fixture("image-archive");
  const img = await registerImage(
    f,
    `https://cdn.example/${marker}/archive.png`,
  );
  let succeed = false;
  const bytes = new Uint8Array([137, 80, 78, 71]);
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () =>
      succeed
        ? new Response(bytes, { headers: { "Content-Type": "image/png" } })
        : new Response("unavailable", { status: 503 }),
    );
  try {
    expect((await imageRead(img.hash)).status).toBe(502);
    expect(await platform.env.R2_PUBLICATIONS.head(img.key)).toBeNull();
    succeed = true;
    const first = await imageRead(img.hash);
    expect(first.status).toBe(200);
    expect(new Uint8Array(await first.arrayBuffer())).toEqual(bytes);
    expect(first.headers.get("cache-control")).not.toContain("immutable");
    const head = await platform.env.R2_PUBLICATIONS.head(img.key);
    expect(head).toMatchObject({
      size: bytes.length,
      httpMetadata: { contentType: "image/png" },
    });
    succeed = false;
    const cached = await imageRead(img.hash);
    expect(cached.status).toBe(200);
    expect(new Uint8Array(await cached.arrayBuffer())).toEqual(bytes);
    expect(cached.headers.get("etag")).toBe(`"${head?.etag}"`);
    expect(
      (
        await imageRead(img.hash, {
          "If-None-Match": cached.headers.get("etag")!,
        })
      ).status,
    ).toBe(304);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  } finally {
    fetchSpy.mockRestore();
  }
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
