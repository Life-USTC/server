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

async function cleanup(payload: ReturnType<typeof payloadFor>) {
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
