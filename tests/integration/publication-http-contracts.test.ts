import { expect } from "vitest";
import { postPublicationIngestionBatchRoute } from "@/lib/api/routes/publication-ingestion-routes";
import { graphqlSchema } from "@/lib/graphql/schema";
import { publicationHttpTest as it } from "./publication-http-fixture";

it("publications.service-auth", { tags: ["@Publication/REST"] }, async ({
  http,
}) => {
  return http.run(async () => {
    const { batch, post, db, secret } = http;
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
    http.configureSecret("");
    const unconfigured = await post(payload);
    expect(unconfigured.status).toBe(401);
    expect(await unconfigured.json()).toEqual({ error: "Unauthorized" });
    expect(
      await db.ingestionBatch.count({ where: { batchId: payload.batchId } }),
    ).toBe(0);
    http.configureSecret(secret);
    const accepted = await post(payload);
    expect(accepted.status).toBe(200);
    expect(await accepted.text()).not.toContain(secret);
    expect(
      await db.ingestionBatch.count({ where: { batchId: payload.batchId } }),
    ).toBe(1);
  });
});

it("publications.batch-size", {
  tags: ["@Publication/REST"],
  timeout: 30_000,
}, async ({ http }) => {
  return http.run(async () => {
    const { batch, post, db, origin, secret } = http;
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
    const streamed = await http.request(() =>
      postPublicationIngestionBatchRoute(
        new Request(`${origin}/api/ingestion/publications/batches`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "X-Publication-Ingestion-Secret": secret,
          },
          body: stream,
          duplex: "half",
        } as RequestInit),
      ),
    );
    expect(streamed.status).toBe(413);
    await streamed.arrayBuffer();
    expect(cancelled).toBe(true);
    expect(consumed).toBeLessThanOrEqual(bytes + 2 * 64 * 1024);
  });
});

it("publications.public-read", { tags: ["@Publication/REST"] }, async ({
  http,
}) => {
  return http.run(async () => {
    const { batch, post, db, marker, origin } = http;
    const payload = batch("public");
    const collegeId = `${payload.sources[0].id}-college`;
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
    const list = await http.fetch(base);
    expect(list.status).toBe(200);
    const listed = await list.json();
    expect(new Set(listed.data.map((row: { id: string }) => row.id))).toEqual(
      new Set([news, notice]),
    );
    expect(listed.pagination.total).toBe(2);
    for (const id of [news, notice]) {
      const detail = await http.fetch(`${origin}/api/publications/${id}`);
      expect(detail.status).toBe(200);
      expect((await detail.json()).id).toBe(id);
    }
    for (const id of [other, deleted, "missing-publication"]) {
      const hidden = await http.fetch(`${origin}/api/publications/${id}`);
      expect(hidden.status).toBe(404);
      await hidden.arrayBuffer();
    }
  });
});

it("publications.public-list-filters", { tags: ["@Publication/REST"] }, async ({
  http,
}) => {
  return http.run(async () => {
    const { batch, post, marker, origin } = http;
    const payload = batch("filters");
    const collegeId = `${payload.sources[0].id}-college`;
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
    const pageOne = await (
      await http.fetch(`${base}&page=1&pageSize=1`)
    ).json();
    const pageTwo = await (
      await http.fetch(`${base}&page=2&pageSize=1`)
    ).json();
    expect(pageOne.pagination).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 2,
    });
    expect(pageTwo.pagination).toMatchObject({
      page: 2,
      pageSize: 1,
      total: 2,
    });
    expect(
      new Set(
        [...pageOne.data, ...pageTwo.data].map((row: { id: string }) => row.id),
      ),
    ).toEqual(new Set([news, notice]));
    const repeated = await http.fetch(
      `${origin}/api/publications?query=${marker}&source=${payload.sources[0].id}&source=${collegeId}&source=${collegeId}&organizationLevel=college&type=notice&page=1&pageSize=1`,
    );
    expect(repeated.status).toBe(200);
    expect(
      (await repeated.json()).data.map((row: { id: string }) => row.id),
    ).toEqual([notice]);
    const duplicateIds = new URLSearchParams({ query: marker });
    for (let index = 0; index < 21; index++)
      duplicateIds.append("source", collegeId);
    const deduped = await http.fetch(
      `${origin}/api/publications?${duplicateIds}`,
    );
    expect(deduped.status).toBe(200);
    expect(
      (await deduped.json()).data.map((row: { id: string }) => row.id),
    ).toEqual([notice]);
    const boundary = await http.fetch(
      `${origin}/api/publications?source=${[collegeId, ...Array.from({ length: 19 }, (_, index) => `source-${index}`)].join(",")}`,
    );
    expect(boundary.status).toBe(200);
    expect(
      (await boundary.json()).data.map((row: { id: string }) => row.id),
    ).toEqual([notice]);
    const overflow = await http.fetch(
      `${origin}/api/publications?source=${Array.from({ length: 21 }, (_, index) => `source-${index}`).join(",")}`,
    );
    expect(overflow.status).toBe(400);
    await overflow.arrayBuffer();
  });
});

it("publications.batch-idempotency", { tags: ["@Publication/REST"] }, async ({
  http,
}) => {
  return http.run(async () => {
    const { batch, post, db } = http;
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
});

it("publications.read-transport-boundary", {
  tags: ["@Publication/REST"],
}, async ({ http, publicationMcp: clients }) => {
  return http.run(async () => {
    const { batch, post, origin } = http;
    const payload = batch("transport");
    const ingested = await post(payload);
    expect(ingested.status).toBe(200);
    const result = await ingested.json();
    const publicationId = result.results[0].publicationId;
    const list = await http.fetch(
      `${origin}/api/publications?source=${payload.sources[0].id}`,
    );
    expect(list.status).toBe(200);
    expect(
      (await list.json()).data.map((row: { id: string }) => row.id),
    ).toEqual([publicationId]);
    const detail = await http.fetch(
      `${origin}/api/publications/${publicationId}`,
    );
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ id: publicationId });
    const sources = await http.fetch(`${origin}/api/publications/sources`);
    expect(sources.status).toBe(200);
    expect(JSON.stringify(await sources.json())).toContain(
      payload.sources[0].id,
    );
    expect(
      Object.keys(graphqlSchema.getTypeMap()).filter((name) =>
        /publication/i.test(name),
      ),
    ).toEqual([]);
    for (const field of ["publications", "publicationSources"]) {
      const response = await http.fetch(`${origin}/api/graphql`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: `{ ${field} { id } }` }),
      });
      const body = await response.json();
      expect(body.data).toBeUndefined();
      expect(body.errors[0].message).toContain(`Cannot query field "${field}"`);
    }
    for (const client of clients) {
      const discovery = await client.listTools();
      expect(
        discovery.tools.filter((tool) => /publication/i.test(tool.name)),
      ).toEqual([]);
      const missing = await client.callToolResult("publication_list", {});
      expect(missing.isError).toBe(true);
      expect(missing.content).toEqual([
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("not found"),
        }),
      ]);
    }
  });
});

it("publications.public-cache", { tags: ["@Publication/REST"] }, async ({
  http,
}) => {
  return http.run(async () => {
    const { batch, post, marker, origin } = http;
    const payload = batch("json-cache");
    const created = await post(payload);
    expect(created.status).toBe(200);
    const id = (await created.json()).results[0].publicationId;
    for (const path of [
      `/api/publications?query=${marker}`,
      `/api/publications/${id}`,
    ]) {
      const response = await http.fetch(`${origin}${path}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(response.headers.get("cache-control")).toBe(
        "public, max-age=0, s-maxage=120, stale-while-revalidate=300",
      );
      expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
        "public, max-age=120, stale-while-revalidate=300",
      );
      expect(response.headers.get("set-cookie")).toBeNull();
      await response.json();
    }
    const missing = await http.fetch(
      `${origin}/api/publications/${crypto.randomUUID()}`,
    );
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("private, no-store");
    await missing.json();
  });
});
