/**
 * E2E coverage for the machine-authenticated publication ingestion API.
 *
 * The request is intentionally made without a user sign-in. The Worker must
 * accept only its dedicated secret and persist a service-owned batch.
 */
import { expect, test } from "@playwright/test";
import { withE2ePrisma } from "../../../../../utils/e2e-db/prisma";

const BASE = "/api/ingestion/publications/batches";
const SECRET = "e2e-publication-ingestion-secret";
const SOURCE_ID = "e2e-publication-service-auth";
const CLIENT_RUN_ID = "e2e-publication-service-auth-run";
const BATCH_ID = "e2e-publication-service-auth-batch";

const payload = {
  protocolVersion: "1" as const,
  producerVersion: "e2e-test",
  clientRunId: CLIENT_RUN_ID,
  batchId: BATCH_ID,
  observedAt: "2026-09-01",
  sources: [
    {
      id: SOURCE_ID,
      name: "Publication service auth E2E source",
      organizationLevel: "e2e",
      allowedHosts: ["publication-ingestion.test"],
    },
  ],
  items: [
    {
      sourceId: SOURCE_ID,
      canonicalUrl: "https://publication-ingestion.test/service-auth-e2e",
      revisionHash: "b".repeat(64),
      observedAt: "2026-09-01",
      publicationType: "notice" as const,
      title: "Publication service auth E2E fixture",
      bodyText: "Service-authenticated E2E fixture.",
      objects: [],
    },
  ],
};

async function cleanup() {
  await withE2ePrisma(async (prisma) => {
    const publications = await prisma.publication.findMany({
      where: { sourceId: SOURCE_ID },
      select: { id: true },
    });
    await prisma.$transaction([
      prisma.publicationEventOutbox.deleteMany({
        where: { aggregateId: { in: publications.map(({ id }) => id) } },
      }),
      prisma.publication.deleteMany({ where: { sourceId: SOURCE_ID } }),
      prisma.ingestionBatch.deleteMany({
        where: {
          principalKey: "service:publication-crawler",
          batchId: BATCH_ID,
        },
      }),
      prisma.ingestionRun.deleteMany({
        where: {
          principalKey: "service:publication-crawler",
          clientRunId: CLIENT_RUN_ID,
        },
      }),
      prisma.publicationSource.deleteMany({ where: { id: SOURCE_ID } }),
    ]);
  });
}

test("publication ingestion requires and accepts the service secret", async ({
  request,
}) => {
  await cleanup();

  const unauthorizedResponse = await request.post(BASE);
  expect(unauthorizedResponse.status()).toBe(401);

  try {
    const response = await request.post(BASE, {
      headers: { "X-Publication-Ingestion-Secret": SECRET },
      data: payload,
    });
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      batchId: BATCH_ID,
      results: [expect.objectContaining({ status: "created" })],
    });

    await withE2ePrisma(async (prisma) => {
      await expect(
        prisma.ingestionBatch.findUnique({
          where: {
            principalKey_batchId: {
              principalKey: "service:publication-crawler",
              batchId: BATCH_ID,
            },
          },
          select: { principalId: true, principalKey: true },
        }),
      ).resolves.toEqual({
        principalId: null,
        principalKey: "service:publication-crawler",
      });
    });
  } finally {
    await cleanup();
  }
});
