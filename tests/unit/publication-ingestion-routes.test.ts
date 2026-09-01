import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PUBLICATION_INGESTION_PRINCIPAL_KEY } from "@/lib/auth/service-principal";
import fixture from "../../docs/contracts/fixtures/publication-batch.json";

const { requirePrincipalMock, prismaMock } = vi.hoisted(() => ({
  requirePrincipalMock: vi.fn(),
  prismaMock: {
    $transaction: vi.fn(),
    ingestionBatch: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth/publication-ingestion-auth", () => ({
  requirePublicationIngestionPrincipal: requirePrincipalMock,
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

function postRequest(body: unknown) {
  return new Request(
    "https://life.example/api/ingestion/publications/batches",
    {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
}

describe("publication ingestion routes", () => {
  let postPublicationIngestionBatchRoute: typeof import("@/lib/api/routes/publication-ingestion-routes").postPublicationIngestionBatchRoute;

  beforeAll(async () => {
    ({ postPublicationIngestionBatchRoute } = await import(
      "@/lib/api/routes/publication-ingestion-routes"
    ));
  });

  afterEach(() => {
    requirePrincipalMock.mockReset();
    prismaMock.$transaction.mockReset();
    prismaMock.ingestionBatch.findUnique.mockReset();
  });

  it("rejects nested NUL characters before opening a database transaction", async () => {
    requirePrincipalMock.mockResolvedValue({
      kind: "service",
      serviceId: "publication-crawler",
      principalKey: PUBLICATION_INGESTION_PRINCIPAL_KEY,
    });

    const response = await postPublicationIngestionBatchRoute(
      postRequest({
        ...fixture,
        items: [
          {
            ...fixture.items[0],
            rawMetadata: {
              authors: [{ name: "张三" }, { name: "李四\u0000" }],
            },
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid publication ingestion batch",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.ingestionBatch.findUnique).not.toHaveBeenCalled();
  });
});
