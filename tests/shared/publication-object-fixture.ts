import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { publicationImageR2Key } from "@/features/publications/server/publication-image-service";
import { ingestPublicationBatch } from "@/features/publications/server/publication-ingestion-service";
import {
  type CloudflareR2Bucket,
  runWithCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";
import {
  postPublicationObjectPlanRoute,
  putPublicationObjectRoute,
} from "@/lib/api/routes/publication-ingestion-routes";
import {
  getPublicPublicationImageRoute,
  getPublicPublicationObjectRoute,
} from "@/lib/api/routes/publication-public-routes";
import { publicationIngestionBatchRequestSchema } from "@/lib/api/schemas/request-publication-ingestion-schemas";
import { PUBLICATION_INGESTION_SERVICE_PRINCIPAL as principal } from "@/lib/auth/service-principal";
import { createFixturePrisma, type TestPrismaClient } from "./prisma";

type PublicationBucket = CloudflareR2Bucket & {
  list(options?: { cursor?: string }): Promise<{
    objects: { key: string }[];
    truncated: boolean;
    cursor?: string;
  }>;
};
const origin = "https://life.example";
function publicationHelpers(db: TestPrismaClient, bucket: PublicationBucket) {
  const marker = crypto.randomUUID();
  const secret = `object-contract-${marker}`;
  const auth = { "X-Publication-Ingestion-Secret": secret };
  const sources = new Set<string>();
  const batches = new Set<string>();
  const runs = new Set<string>();
  const hashes = new Set<string>();
  const imageHashes = new Set<string>();
  const responses: Response[] = [];
  if (!process.env.DATABASE_URL)
    throw new Error(
      "Publication tests require a restricted runtime database URL",
    );
  const appConnection = new URL(process.env.DATABASE_URL);
  const connectionLabel = `publication-${marker}`;
  appConnection.searchParams.set("application_name", connectionLabel);
  async function fixture(label: string, contentType = "text/markdown") {
    const bytes = new TextEncoder().encode(`# Publication ${marker} ${label}`);
    const sha256 = Buffer.from(
      await crypto.subtle.digest("SHA-256", bytes),
    ).toString("hex");
    hashes.add(sha256);
    const sourceId = `obj-${crypto.randomUUID()}`;
    sources.add(sourceId);
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
    const publicationId = response.results[0].publicationId;
    if (!publicationId) throw new Error("Expected ingested publication ID");
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
    batches.add(payload.batchId);
    runs.add(payload.clientRunId);
    for (const source of payload.sources) sources.add(source.id);
    for (const item of payload.items) {
      if (item.tombstone) continue;
      for (const object of item.objects ?? []) hashes.add(object.sha256);
      for (const hash of Object.keys(item.imageSources ?? {}))
        imageHashes.add(hash);
    }
    return runtime(() => ingestPublicationBatch({ payload, principal }));
  }
  async function runtime<T>(callback: () => T | Promise<T>) {
    const result = await runWithCloudflareRuntimeEnv(
      {
        PUBLICATION_INGESTION_SECRET: secret,
        R2_PUBLICATIONS: bucket,
        HYPERDRIVE: { connectionString: appConnection.href },
      },
      callback,
    );
    if (result instanceof Response) responses.push(result);
    return result;
  }
  async function responseStatus(pending: Promise<Response>) {
    const response = await pending;
    const status = response.status;
    if (response.body && !response.bodyUsed) await response.body.cancel();
    return status;
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
  async function registerImage(f: Fixture, url: string) {
    const hash = Buffer.from(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url)),
    ).toString("hex");
    imageHashes.add(hash);
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

  async function cleanup() {
    const cancelled = await Promise.allSettled(
      responses.map((response) =>
        response.body && !response.bodyUsed
          ? response.body.cancel()
          : undefined,
      ),
    );
    await db.$transaction(async (tx) => {
      const publications = await tx.publication.findMany({
        where: { sourceId: { in: [...sources] } },
        select: { id: true },
      });
      await tx.publicationEventOutbox.deleteMany({
        where: { aggregateId: { in: publications.map((p) => p.id) } },
      });
      await tx.publicationSource.deleteMany({
        where: { id: { in: [...sources] } },
      });
      await tx.ingestionBatch.deleteMany({
        where: { batchId: { in: [...batches] } },
      });
      await tx.ingestionRun.deleteMany({
        where: { clientRunId: { in: [...runs] } },
      });
      await tx.publicationObject.deleteMany({
        where: { sha256: { in: [...hashes] } },
      });
      await tx.publicationImageSource.deleteMany({
        where: { id: { in: [...imageHashes] } },
      });
    });
    const failures = cancelled.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (failures.length)
      throw new AggregateError(failures, "Publication response cleanup failed");
    expect(
      await db.$queryRaw`SELECT application_name FROM pg_stat_activity WHERE application_name = ${connectionLabel}`,
    ).toEqual([]);
  }
  return {
    db,
    bucket,
    marker,
    secret,
    origin,
    connectionLabel,
    fixture,
    ingest,
    runtime,
    responseStatus,
    plan,
    upload,
    read,
    objectRow,
    registerImage,
    imageRead,
    cleanup,
  };
}

export const publicationTest = test.extend<{
  publication: ReturnType<typeof publicationHelpers>;
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest requires destructured fixture dependencies.
  publication: async ({}, use) => {
    const db = createFixturePrisma();
    let directory: string | undefined;
    let platform:
      | PlatformProxy<{ R2_PUBLICATIONS: PublicationBucket }>
      | undefined;
    let owned: ReturnType<typeof publicationHelpers> | undefined;
    try {
      directory = await mkdtemp(join(tmpdir(), "publication-r2-contract-"));
      const configPath = join(directory, "wrangler.json");
      await writeFile(
        configPath,
        JSON.stringify({
          name: "publication-object-contracts",
          compatibility_date: "2026-09-01",
          r2_buckets: [
            {
              binding: "R2_PUBLICATIONS",
              bucket_name: "publication-contracts",
            },
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
      // The proxy cannot preserve a Node stream's known length in workerd.
      // Only materialize fixture bodies across that boundary; real R2 still
      // performs checksum validation, storage, metadata and reads.
      const bucket: PublicationBucket = {
        delete: (key) => actual.delete(key),
        get: (key) => actual.get(key),
        head: (key) => actual.head(key),
        list: (options) => actual.list(options),
        put: async (key, value, options) =>
          actual.put(
            key,
            value instanceof ReadableStream
              ? await new Response(value).arrayBuffer()
              : value,
            options,
          ),
      };
      owned = publicationHelpers(db, bucket);
      await use(owned);
    } finally {
      // Run every cleanup even if response cancellation or DB cleanup fails.
      const results = await Promise.allSettled([owned?.cleanup()]);
      if (platform) {
        const actual = platform.env.R2_PUBLICATIONS;
        results.push(
          ...(await Promise.allSettled([
            (async () => {
              let cursor: string | undefined;
              do {
                const page = await actual.list({ cursor });
                await Promise.all(
                  page.objects.map(({ key }) => actual.delete(key)),
                );
                cursor = page.truncated ? page.cursor : undefined;
              } while (cursor);
              expect((await actual.list()).objects).toEqual([]);
            })(),
          ])),
        );
      }
      results.push(
        ...(await Promise.allSettled([
          platform?.dispose(),
          db.$disconnect(),
          ...(directory
            ? [rm(directory, { recursive: true, force: true })]
            : []),
        ])),
      );
      await Promise.all(
        results.map((result) =>
          result.status === "rejected"
            ? Promise.reject(result.reason)
            : undefined,
        ),
      );
    }
  },
});
