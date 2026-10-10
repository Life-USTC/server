/**
 * REST integration contract for the machine-authenticated publication
 * ingestion API.
 *
 * The Worker receives PUBLICATION_INGESTION_SECRET from wrangler.e2e.jsonc.
 * These requests prove that the service principal can create and replay a
 * batch without a session, OAuth bearer token, or User/admin row.
 */
import { createHash } from "node:crypto";
import { expect } from "@playwright/test";
import { test } from "../../../../e2e/utils/owned-worker";

const BASE = "/api/ingestion/publications/batches";
const OBJECT_PLAN = "/api/ingestion/publications/objects/plan";
const SECRET = "e2e-publication-ingestion-secret";
function payloadFor(suffix: string) {
  const sourceId = `e2e-publication-${suffix}`;
  const canonicalUrl = `https://publication-ingestion.test/${suffix}`;
  return {
    protocolVersion: "1" as const,
    producerVersion: "integration-test",
    clientRunId: `run-${suffix}`,
    batchId: `batch-${suffix}`,
    observedAt: "2026-09-01",
    sources: [
      {
        id: sourceId,
        name: "Publication ingestion integration source",
        organizationLevel: "integration",
        allowedHosts: ["publication-ingestion.test"],
      },
    ],
    items: [
      {
        sourceId,
        canonicalUrl,
        revisionHash: "a".repeat(64),
        observedAt: "2026-09-01",
        publicationType: "news" as const,
        title: "Publication ingestion integration fixture",
        bodyText: "Service-authenticated ingestion fixture.",
        objects: [],
      },
    ],
  };
}

test("ingestion rejects requests without the dedicated secret", {
  tag: "@Publication/REST",
}, async ({ run, request, isolatedWorker }) => {
  await run(async () => {
    const response = await request.post(BASE, {
      data: payloadFor("unauthorized"),
    });
    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    const db = isolatedWorker.database.owner;
    expect(await db.ingestionBatch.count()).toBe(0);
    expect(await db.ingestionRun.count()).toBe(0);
    expect(await db.publicationSource.count()).toBe(0);
    expect(await db.publication.count()).toBe(0);
    expect(await db.publicationEventOutbox.count()).toBe(0);
  });
});

test("ingestion accepts the service secret and scopes ownership to its stable key", {
  tag: "@Publication/REST",
}, async ({ run, request, isolatedWorker }) => {
  await run(async () => {
    const payload = payloadFor("service-auth");

    const response = await request.post(BASE, {
      headers: { "X-Publication-Ingestion-Secret": SECRET },
      data: payload,
    });
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      batchId: payload.batchId,
      clientRunId: payload.clientRunId,
      results: [
        expect.objectContaining({
          canonicalUrl: payload.items[0].canonicalUrl,
          sourceId: payload.sources[0].id,
          status: "created",
        }),
      ],
    });

    const prisma = isolatedWorker.database.owner;
    const batch = await prisma.ingestionBatch.findUnique({
      where: {
        principalKey_batchId: {
          principalKey: "service:publication-crawler",
          batchId: payload.batchId,
        },
      },
      select: { principalId: true, principalKey: true },
    });
    expect(batch).toEqual({
      principalId: null,
      principalKey: "service:publication-crawler",
    });
    expect(await prisma.user.count()).toBe(0);
  });
});

test("unchanged redelivery re-registers claims so missing bytes can be planned and uploaded", {
  tag: "@Publication/REST",
}, async ({ run, request }) => {
  await run(async () => {
    const suffix = "redelivery";
    // Each case owns its Worker storage, including content-addressed objects.
    const bytes = Buffer.from(`publication-object-${suffix}`);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const base = payloadFor(suffix);
    const headers = { "X-Publication-Ingestion-Secret": SECRET };
    const firstPayload = {
      ...base,
      batchId: `batch-${suffix}-first`,
      items: [
        {
          ...base.items[0],
          objects: [
            {
              contentType: "text/plain",
              kind: "body_html" as const,
              sha256,
              size: bytes.length,
            },
          ],
        },
      ],
    };
    const retryPayload = { ...firstPayload, batchId: `batch-${suffix}-retry` };
    const finalPayload = { ...firstPayload, batchId: `batch-${suffix}-final` };

    const first = await request.post(BASE, { data: firstPayload, headers });
    expect(first.status()).toBe(200);
    await expect(first.json()).resolves.toMatchObject({
      results: [{ status: "created" }],
    });

    // The crawler crashed after the batch was accepted but before the object
    // bytes were uploaded, so the event is redelivered under a new batchId.
    const retry = await request.post(BASE, { data: retryPayload, headers });
    expect(retry.status()).toBe(200);
    const retryBody = await retry.json();
    expect(retryBody.results[0]).toMatchObject({
      status: "unchanged",
      objectsNeedingUpload: [{ kind: "body_html", sha256 }],
    });

    // The plan endpoint accepts the retry batchId for the re-registered claim.
    const plan = await request.post(OBJECT_PLAN, {
      data: {
        batchId: retryPayload.batchId,
        objects: [{ kind: "body_html", sha256 }],
      },
      headers,
    });
    expect(plan.status()).toBe(200);
    const planBody = await plan.json();
    const object = planBody.objects[0];
    expect(object).toMatchObject({ status: "upload_required" });
    expect(object.uploadUrl).toContain(retryPayload.batchId);

    const upload = await request.put(object.uploadUrl, {
      data: bytes,
      headers: {
        ...headers,
        ...object.requiredHeaders,
        "Content-Length": String(bytes.length),
      },
    });
    expect(upload.status()).toBe(200);
    await expect(upload.json()).resolves.toMatchObject({ status: "linked" });

    // Once the bytes are linked, a further redelivery stays a plain unchanged.
    const final = await request.post(BASE, { data: finalPayload, headers });
    expect(final.status()).toBe(200);
    const finalBody = await final.json();
    expect(finalBody.results[0].status).toBe("unchanged");
    expect(finalBody.results[0]).not.toHaveProperty("objectsNeedingUpload");
  });
});

test("ingestion streams an object through the authenticated Worker R2 binding", {
  tag: "@Publication/REST",
}, async ({ run, request }) => {
  await run(async () => {
    const suffix = "streaming";
    // Each case owns its Worker storage, including content-addressed objects.
    const bytes = Buffer.from(`publication-object-${suffix}`);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const base = payloadFor(suffix);
    const payload = {
      ...base,
      items: [
        {
          ...base.items[0],
          objects: [
            {
              contentType: "text/plain",
              kind: "body_html" as const,
              sha256,
              size: bytes.length,
            },
          ],
        },
      ],
    };
    const headers = { "X-Publication-Ingestion-Secret": SECRET };

    const batch = await request.post(BASE, { data: payload, headers });
    expect(batch.status()).toBe(200);

    const plan = await request.post(OBJECT_PLAN, {
      data: {
        batchId: payload.batchId,
        objects: [{ kind: "body_html", sha256 }],
      },
      headers,
    });
    expect(plan.status()).toBe(200);
    const planBody = await plan.json();
    const object = planBody.objects[0];
    expect(object).toMatchObject({
      requiredHeaders: { "Content-Type": "text/plain" },
      status: "upload_required",
    });

    const upload = await request.put(object.uploadUrl, {
      data: bytes,
      headers: {
        ...headers,
        ...object.requiredHeaders,
        "Content-Length": String(bytes.length),
      },
    });
    expect(upload.status()).toBe(200);
    await expect(upload.json()).resolves.toEqual({
      batchId: payload.batchId,
      kind: "body_html",
      sha256,
      status: "linked",
    });

    const downloaded = await request.get(
      `/api/publications/objects/body_html/${sha256}`,
    );
    expect(downloaded.status()).toBe(200);
    expect(await downloaded.body()).toEqual(bytes);

    const replayPlan = await request.post(OBJECT_PLAN, {
      data: {
        batchId: payload.batchId,
        objects: [{ kind: "body_html", sha256 }],
      },
      headers,
    });
    expect(replayPlan.status()).toBe(200);
    await expect(replayPlan.json()).resolves.toMatchObject({
      objects: [{ status: "already_present", uploadUrl: null }],
    });
  });
});
