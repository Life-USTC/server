/**
 * REST integration contract for the machine-authenticated publication
 * ingestion API.
 *
 * The Worker receives PUBLICATION_INGESTION_SECRET from wrangler.e2e.jsonc.
 * These requests prove that the service principal can create and replay a
 * batch without a session, OAuth bearer token, or User/admin row.
 */
import { expect, test } from "@playwright/test";
import { withE2ePrisma } from "../../../../e2e/utils/e2e-db/prisma";

const BASE = "/api/ingestion/publications/batches";
const OBJECT_PLAN = "/api/ingestion/publications/objects/plan";
const SECRET = "e2e-publication-ingestion-secret";
const SHA256_OF_ABC =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
// A second content address keeps the redelivery test's R2 bytes isolated from
// the streaming test, which expects its own object to start missing.
const SHA256_OF_XYZ =
  "3608bca1e44ea6c4d268eb6db02260269892c0b42b86bbf1e77a6fa16c3c9282";

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

type CleanupPayload = Pick<
  ReturnType<typeof payloadFor>,
  "batchId" | "clientRunId" | "sources"
>;

async function cleanup(payload: CleanupPayload) {
  await withE2ePrisma(async (prisma) => {
    const publications = await prisma.publication.findMany({
      where: { sourceId: payload.sources[0].id },
      select: { id: true },
    });
    await prisma.$transaction([
      prisma.publicationEventOutbox.deleteMany({
        where: { aggregateId: { in: publications.map(({ id }) => id) } },
      }),
      prisma.publication.deleteMany({
        where: { sourceId: payload.sources[0].id },
      }),
      prisma.ingestionBatch.deleteMany({
        where: {
          principalKey: "service:publication-crawler",
          batchId: payload.batchId,
        },
      }),
      prisma.ingestionRun.deleteMany({
        where: {
          principalKey: "service:publication-crawler",
          clientRunId: payload.clientRunId,
        },
      }),
      prisma.publicationSource.deleteMany({
        where: { id: payload.sources[0].id },
      }),
    ]);
    await prisma.publicationObject.deleteMany({
      where: { kind: "body_html", sha256: SHA256_OF_ABC },
    });
  });
}

test("ingestion rejects requests without the dedicated secret", async ({
  request,
}) => {
  const response = await request.post(BASE);
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
});

test("ingestion accepts the service secret and scopes ownership to its stable key", async ({
  request,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const payload = payloadFor(suffix);

  try {
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

    await withE2ePrisma(async (prisma) => {
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
    });
  } finally {
    await cleanup(payload);
  }
});

test("unchanged redelivery re-registers claims so missing bytes can be planned and uploaded", async ({
  request,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
            sha256: SHA256_OF_XYZ,
            size: 3,
          },
        ],
      },
    ],
  };
  const retryPayload = { ...firstPayload, batchId: `batch-${suffix}-retry` };
  const finalPayload = { ...firstPayload, batchId: `batch-${suffix}-final` };

  await cleanup(firstPayload);
  await cleanup(retryPayload);
  await cleanup(finalPayload);
  try {
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
      objectsNeedingUpload: [{ kind: "body_html", sha256: SHA256_OF_XYZ }],
    });

    // The plan endpoint accepts the retry batchId for the re-registered claim.
    const plan = await request.post(OBJECT_PLAN, {
      data: {
        batchId: retryPayload.batchId,
        objects: [{ kind: "body_html", sha256: SHA256_OF_XYZ }],
      },
      headers,
    });
    expect(plan.status()).toBe(200);
    const planBody = await plan.json();
    const object = planBody.objects[0];
    expect(object).toMatchObject({ status: "upload_required" });
    expect(object.uploadUrl).toContain(retryPayload.batchId);

    const upload = await request.put(object.uploadUrl, {
      data: Buffer.from("xyz"),
      headers: {
        ...headers,
        ...object.requiredHeaders,
        "Content-Length": "3",
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
  } finally {
    await cleanup(firstPayload);
    await cleanup(retryPayload);
    await cleanup(finalPayload);
    await withE2ePrisma(async (prisma) => {
      await prisma.publicationObject.deleteMany({
        where: { kind: "body_html", sha256: SHA256_OF_XYZ },
      });
    });
  }
});

test("ingestion streams an object through the authenticated Worker R2 binding", async ({
  request,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
            sha256: SHA256_OF_ABC,
            size: 3,
          },
        ],
      },
    ],
  };
  const headers = { "X-Publication-Ingestion-Secret": SECRET };

  await cleanup(payload);
  try {
    const batch = await request.post(BASE, { data: payload, headers });
    expect(batch.status()).toBe(200);

    const plan = await request.post(OBJECT_PLAN, {
      data: {
        batchId: payload.batchId,
        objects: [{ kind: "body_html", sha256: SHA256_OF_ABC }],
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
      data: Buffer.from("abc"),
      headers: {
        ...headers,
        ...object.requiredHeaders,
        "Content-Length": "3",
      },
    });
    expect(upload.status()).toBe(200);
    await expect(upload.json()).resolves.toEqual({
      batchId: payload.batchId,
      kind: "body_html",
      sha256: SHA256_OF_ABC,
      status: "linked",
    });

    const replayPlan = await request.post(OBJECT_PLAN, {
      data: {
        batchId: payload.batchId,
        objects: [{ kind: "body_html", sha256: SHA256_OF_ABC }],
      },
      headers,
    });
    await expect(replayPlan.json()).resolves.toMatchObject({
      objects: [{ status: "already_present", uploadUrl: null }],
    });
  } finally {
    await cleanup(payload);
  }
});
