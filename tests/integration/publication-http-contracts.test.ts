import { createServer, type Server } from "node:http";
import { getRequest, setResponse } from "@sveltejs/kit/node";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { postPublicationIngestionBatchRoute } from "@/lib/api/routes/publication-ingestion-routes";
import {
  getPublicationsRoute,
  getPublicPublicationRoute,
} from "@/lib/api/routes/publication-public-routes";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const secret = `private-ingestion-${marker}`;
const sources: string[] = [];
const batches: string[] = [];
let server: Server;
let origin: string;
function batch(label: string) {
  const sourceId = `http-${marker.slice(0, 20)}-${label}`;
  sources.push(sourceId);
  const batchId = `${marker}-${label}`;
  batches.push(batchId);
  return {
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
        canonicalUrl: `https://publication.example/${marker}/${label}`,
        revisionHash: "a".repeat(64),
        observedAt: "2026-09-01",
        publicationType: "news",
        title: `${marker} ${label}`,
        objects: [],
      },
    ],
  };
}
async function post(
  body: unknown,
  headers: Record<string, string> = {
    "X-Publication-Ingestion-Secret": secret,
  },
) {
  return fetch(`${origin}/api/ingestion/publications/batches`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
beforeAll(async () => {
  vi.stubEnv("PUBLICATION_INGESTION_SECRET", secret);
  server = createServer(async (incoming, outgoing) => {
    try {
      const request = await getRequest({ request: incoming, base: origin });
      const path = new URL(request.url).pathname;
      const response =
        request.method === "POST"
          ? await postPublicationIngestionBatchRoute(request)
          : path === "/api/publications"
            ? await getPublicationsRoute(request)
            : await getPublicPublicationRoute(request, {
                id: path.split("/").at(-1)!,
              });
      await setResponse(outgoing, response);
    } catch {
      outgoing.statusCode = 500;
      outgoing.end("Internal error");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing address");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  const publications = await db.publication.findMany({
    where: { sourceId: { in: sources } },
    select: { id: true },
  });
  await db.publicationEventOutbox.deleteMany({
    where: { aggregateId: { in: publications.map((row) => row.id) } },
  });
  await db.publicationSource.deleteMany({ where: { id: { in: sources } } });
  await db.ingestionBatch.deleteMany({ where: { batchId: { in: batches } } });
  await db.ingestionRun.deleteMany({ where: { clientRunId: { in: batches } } });
  await db.$disconnect();
  vi.unstubAllEnvs();
});

it("publications.service-auth", async () => {
  const payload = batch("auth");
  const authorizationCases: Record<string, string>[] = [
    {},
    { "X-Publication-Ingestion-Secret": "wrong" },
    { authorization: `Bearer ${secret}` },
  ];
  for (const headers of authorizationCases) {
    const response = await post(payload, headers);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  }
  vi.stubEnv("PUBLICATION_INGESTION_SECRET", "");
  const unconfigured = await post(payload);
  expect(unconfigured.status).toBe(401);
  expect(await unconfigured.json()).toEqual({ error: "Unauthorized" });
  expect(
    await db.ingestionBatch.count({ where: { batchId: payload.batchId } }),
  ).toBe(0);
  vi.stubEnv("PUBLICATION_INGESTION_SECRET", secret);
  const accepted = await post(payload);
  expect(accepted.status).toBe(200);
  expect(await accepted.text()).not.toContain(secret);
  expect(
    await db.ingestionBatch.count({ where: { batchId: payload.batchId } }),
  ).toBe(1);
});

it("publications.batch-size", { timeout: 30_000 }, async () => {
  const payload = batch("body-limit");
  const bytes = 8 * 1024 * 1024;
  const exact = JSON.stringify(payload).padEnd(bytes, " ");
  const accepted = await post(exact);
  expect(accepted.status).toBe(200);
  await accepted.arrayBuffer();
  const rejectedPayload = batch("body-overflow");
  const response = await post(
    JSON.stringify(rejectedPayload).padEnd(bytes + 1, " "),
  );
  expect(response.status).toBe(413);
  await response.arrayBuffer();
  expect(
    await db.ingestionBatch.count({
      where: { batchId: rejectedPayload.batchId },
    }),
  ).toBe(0);
  let consumed = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      consumed += 64 * 1024;
      controller.enqueue(new Uint8Array(64 * 1024).fill(32));
    },
    cancel() {
      cancelled = true;
    },
  });
  const streamed = await postPublicationIngestionBatchRoute(
    new Request(`${origin}/api/ingestion/publications/batches`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Publication-Ingestion-Secret": secret,
      },
      body: stream,
      duplex: "half",
    } as RequestInit),
  );
  expect(streamed.status).toBe(413);
  expect(cancelled).toBe(true);
  expect(consumed).toBeLessThanOrEqual(bytes + 2 * 64 * 1024);
});

it("publications.public-read", async () => {
  const payload = batch("public");
  const collegeId = `${payload.sources[0].id}-college`;
  sources.push(collegeId);
  payload.sources.push({
    id: collegeId,
    name: "college",
    organizationLevel: "college",
    allowedHosts: ["publication.example"],
  });
  payload.items.push(
    {
      ...payload.items[0],
      sourceId: collegeId,
      canonicalUrl: `${payload.items[0].canonicalUrl}/notice`,
      publicationType: "notice",
      title: `${marker} notice`,
    },
    {
      ...payload.items[0],
      canonicalUrl: `${payload.items[0].canonicalUrl}/other`,
      publicationType: "other",
    },
    {
      ...payload.items[0],
      canonicalUrl: `${payload.items[0].canonicalUrl}/deleted`,
    },
  );
  const write = await post(payload);
  expect(write.status).toBe(200);
  const created = await write.json();
  const [news, notice, other, deleted] = created.results.map(
    (row: { publicationId: string }) => row.publicationId,
  );
  await db.publication.update({
    where: { id: deleted },
    data: { deletedAt: new Date() },
  });
  const base = `${origin}/api/publications?query=${marker}&source=${payload.sources[0].id},${collegeId}`;
  const list = await fetch(base);
  expect(list.status).toBe(200);
  const listed = await list.json();
  expect(new Set(listed.data.map((row: { id: string }) => row.id))).toEqual(
    new Set([news, notice]),
  );
  expect(listed.pagination.total).toBe(2);
  for (const id of [news, notice]) {
    const detail = await fetch(`${origin}/api/publications/${id}`);
    expect(detail.status).toBe(200);
    expect((await detail.json()).id).toBe(id);
  }
  for (const id of [other, deleted, "missing-publication"]) {
    const hidden = await fetch(`${origin}/api/publications/${id}`);
    expect(hidden.status).toBe(404);
    await hidden.arrayBuffer();
  }
});

it("publications.public-list-filters", async () => {
  const payload = batch("filters");
  const collegeId = `${payload.sources[0].id}-college`;
  sources.push(collegeId);
  payload.sources.push({
    id: collegeId,
    name: "college",
    organizationLevel: "college",
    allowedHosts: ["publication.example"],
  });
  payload.items.push({
    ...payload.items[0],
    sourceId: collegeId,
    canonicalUrl: `${payload.items[0].canonicalUrl}/notice`,
    publicationType: "notice",
    title: `${marker} filtered notice`,
  });
  const write = await post(payload);
  expect(write.status).toBe(200);
  const created = await write.json();
  const [news, notice] = created.results.map(
    (row: { publicationId: string }) => row.publicationId,
  );
  const base = `${origin}/api/publications?query=${marker}&source=${payload.sources[0].id},${collegeId}`;
  const pageOne = await (await fetch(`${base}&page=1&pageSize=1`)).json();
  const pageTwo = await (await fetch(`${base}&page=2&pageSize=1`)).json();
  expect(pageOne.pagination).toMatchObject({ page: 1, pageSize: 1, total: 2 });
  expect(pageTwo.pagination).toMatchObject({ page: 2, pageSize: 1, total: 2 });
  expect(
    new Set(
      [...pageOne.data, ...pageTwo.data].map((row: { id: string }) => row.id),
    ),
  ).toEqual(new Set([news, notice]));
  const repeated = await fetch(
    `${origin}/api/publications?query=${marker}&source=${payload.sources[0].id}&source=${collegeId}&source=${collegeId}&organizationLevel=college&type=notice&page=1&pageSize=1`,
  );
  expect(repeated.status).toBe(200);
  expect(
    (await repeated.json()).data.map((row: { id: string }) => row.id),
  ).toEqual([notice]);
  const duplicateIds = new URLSearchParams({ query: marker });
  for (let index = 0; index < 21; index++)
    duplicateIds.append("source", collegeId);
  const deduped = await fetch(`${origin}/api/publications?${duplicateIds}`);
  expect(deduped.status).toBe(200);
  expect(
    (await deduped.json()).data.map((row: { id: string }) => row.id),
  ).toEqual([notice]);
  const boundary = await fetch(
    `${origin}/api/publications?source=${[collegeId, ...Array.from({ length: 19 }, (_, index) => `source-${index}`)].join(",")}`,
  );
  expect(boundary.status).toBe(200);
  expect(
    (await boundary.json()).data.map((row: { id: string }) => row.id),
  ).toEqual([notice]);
  const overflow = await fetch(
    `${origin}/api/publications?source=${Array.from({ length: 21 }, (_, index) => `source-${index}`).join(",")}`,
  );
  expect(overflow.status).toBe(400);
});

it("publications.batch-idempotency", async () => {
  const payload = batch("idempotency");
  const response = await post(payload);
  expect(response.status).toBe(200);
  const first = await response.json();
  const replay = await post(structuredClone(payload));
  expect(replay.status).toBe(200);
  expect(await replay.json()).toEqual(first);
  const conflict = await post({
    ...payload,
    items: [{ ...payload.items[0], title: "changed" }],
  });
  expect(conflict.status).toBe(409);
  expect((await conflict.json()).error).toContain("different payload");
  expect(
    await db.ingestionBatch.count({ where: { batchId: payload.batchId } }),
  ).toBe(1);
  expect(
    await db.publicationRevision.count({
      where: { publicationId: first.results[0].publicationId },
    }),
  ).toBe(1);
  expect(
    await db.ingestionRun.count({
      where: { clientRunId: payload.clientRunId },
    }),
  ).toBe(1);
});
