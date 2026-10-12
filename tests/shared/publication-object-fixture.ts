import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, vi } from "vitest";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { publicationImageR2Key } from "@/features/publications/server/publication-image-service";
import { ingestPublicationBatch } from "@/features/publications/server/publication-ingestion-service";
import type { CloudflareR2Bucket } from "@/lib/adapters/cloudflare-runtime";
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
import {
  type IsolatedDatabase,
  isolatedDatabaseTest,
} from "./isolated-database";
import {
  createNodeProtocolRuntime,
  type NodeProtocolRuntime,
} from "./node-protocol-runtime";
import type { TestPrismaClient } from "./prisma";

type PublicationBucket = CloudflareR2Bucket & {
  list(options?: { cursor?: string }): Promise<{
    objects: { key: string }[];
    truncated: boolean;
    cursor?: string;
  }>;
};
const origin = "https://life.example";
function publicationHelpers(
  db: TestPrismaClient,
  bucket: PublicationBucket,
  protocolRuntime: NodeProtocolRuntime,
  marker: string,
  secret: string,
) {
  const auth = { "X-Publication-Ingestion-Secret": secret };
  const runtime = protocolRuntime.request;
  async function fixture(label: string, contentType = "text/markdown") {
    const bytes = new TextEncoder().encode(`# Publication ${marker} ${label}`);
    const sha256 = Buffer.from(
      await crypto.subtle.digest("SHA-256", bytes),
    ).toString("hex");
    const sourceId = `obj-${crypto.randomUUID()}`;
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
    return runtime(() => ingestPublicationBatch({ payload, principal }));
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

  return {
    db,
    bucket,
    marker,
    secret,
    origin,
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
    run: protocolRuntime.run,
    closeRuntime: protocolRuntime.close,
  };
}

function ownPublicationResources(isolatedDatabase: IsolatedDatabase) {
  const db = isolatedDatabase.owner;
  const marker = crypto.randomUUID();
  const secret = `object-contract-${marker}`;
  const connectionLabel = `publication-${marker}`;
  const appConnection = new URL(isolatedDatabase.connections.app);
  appConnection.searchParams.set("application_name", connectionLabel);
  const objectBodies = new Set<ReadableStream<Uint8Array>>();
  let directory: string | undefined;
  let platform:
    | PlatformProxy<{ R2_PUBLICATIONS: PublicationBucket }>
    | undefined;
  let runtime: NodeProtocolRuntime | undefined;
  let initialization:
    | Promise<ReturnType<typeof publicationHelpers>>
    | undefined;
  let closing: Promise<void> | undefined;

  function initialize() {
    if (closing)
      return Promise.reject(new Error("Publication resources are closing"));
    initialization ??= (async () => {
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
        get: async (key) => {
          const object = await actual.get(key);
          if (object) objectBodies.add(object.body);
          return object;
        },
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
      runtime = createNodeProtocolRuntime({
        APP_PUBLIC_ORIGIN: origin,
        PUBLICATION_INGESTION_SECRET: secret,
        R2_PUBLICATIONS: bucket,
        HYPERDRIVE: { connectionString: appConnection.href },
        HYPERDRIVE_AUTH: {
          connectionString: isolatedDatabase.connections.auth,
        },
        HYPERDRIVE_MAINTENANCE: {
          connectionString: isolatedDatabase.connections.maintenance,
        },
      });
      if (closing)
        throw new Error("Publication resources closed during initialization");
      return publicationHelpers(db, bucket, runtime, marker, secret);
    })();
    return initialization;
  }

  function close() {
    closing ??= (async () => {
      // The dependent fixture reports initialization failure. If it times out,
      // still join the original promise so a late platform cannot escape disposal.
      await initialization?.catch(() => undefined);
      const failures: unknown[] = [];
      async function attempt(work: () => unknown | Promise<unknown>) {
        try {
          await work();
        } catch (error) {
          failures.push(error);
        }
      }
      // Keep R2 and the DB alive until admitted workflows, route responses and
      // their background cleanup finish, including a timed-out test body.
      await attempt(() => runtime?.close());
      // Direct fixture observations also borrow real R2 bodies. Cancel bodies
      // left unread by an assertion failure after the complete workflow stops.
      const cancelled = await Promise.allSettled(
        [...objectBodies].map(async (body) =>
          body.locked ? undefined : body.cancel(),
        ),
      );
      failures.push(
        ...cancelled.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        ),
      );
      objectBodies.clear();
      await attempt(async () => {
        expect(
          await db.$queryRaw`SELECT application_name FROM pg_stat_activity WHERE application_name = ${connectionLabel}`,
        ).toEqual([]);
      });
      if (platform) {
        const actual = platform.env.R2_PUBLICATIONS;
        await attempt(async () => {
          let cursor: string | undefined;
          do {
            const page = await actual.list({ cursor });
            const deleted = await Promise.allSettled(
              page.objects.map(async ({ key }) => actual.delete(key)),
            );
            failures.push(
              ...deleted.flatMap((result) =>
                result.status === "rejected" ? [result.reason] : [],
              ),
            );
            cursor = page.truncated ? page.cursor : undefined;
          } while (cursor);
        });
        await attempt(async () => {
          expect((await actual.list()).objects).toEqual([]);
        });
        await attempt(() => platform?.dispose());
      }
      // Directory removal follows platform disposal; neither races active R2 IO.
      const ownedDirectory = directory;
      if (ownedDirectory)
        await attempt(() =>
          rm(ownedDirectory, { recursive: true, force: true }),
        );
      if (failures.length)
        throw new AggregateError(
          failures,
          "Publication resources failed to close",
        );
    })();
    return closing;
  }
  return { initialize, close };
}

export const publicationTest = isolatedDatabaseTest.extend<{
  _publicationResources: ReturnType<typeof ownPublicationResources>;
  publication: ReturnType<typeof publicationHelpers>;
}>({
  _publicationResources: async ({ isolatedDatabase, onTestFinished }, use) => {
    const resources = ownPublicationResources(isolatedDatabase);
    try {
      // Register ownership before a dependent fixture starts async platform IO.
      await use(resources);
    } finally {
      try {
        await resources.close();
      } catch (error) {
        // Finish dependency/database cleanup before reporting all original errors.
        onTestFinished(() => {
          throw error;
        });
      }
    }
  },
  publication: async ({ _publicationResources }, use) => {
    await use(await _publicationResources.initialize());
  },
});

// Each image consumer retains one case per isolated runner file. A global fetch
// spy is not safe for arbitrary concurrent cases in the same module environment.
export const publicationFetchTest = publicationTest.extend(
  "fetchSpy",
  async ({ publication, onTestFinished }, { onCleanup }) => {
    const spy = vi.spyOn(globalThis, "fetch");
    onCleanup(async () => {
      // The resource owner reports the cached close failure after cleanup.
      // Keep the controlled fetch boundary until every admitted request drains.
      await Promise.allSettled([publication.closeRuntime()]);
      try {
        spy.mockRestore();
      } catch (error) {
        onTestFinished(() => {
          throw error;
        });
      }
    });
    return spy;
  },
);
