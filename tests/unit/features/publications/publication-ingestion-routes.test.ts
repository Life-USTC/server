import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PUBLICATION_INGESTION_BATCH_MAX_BODY_BYTES } from "@/features/publications/lib/publication-ingestion-limits";
import { PUBLICATION_INGESTION_PRINCIPAL_KEY } from "@/lib/auth/service-principal";
import fixture from "../../../../docs/contracts/fixtures/publication-batch.json";

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

/**
 * A body that never ends. Before the byte budget existed the handler buffered
 * the whole request first, so an oversized batch exhausted the Workers isolate
 * (`exceededMemory`) instead of answering.
 */
function endlessPostRequest(headers: Record<string, string> = {}) {
  const chunk = new TextEncoder().encode("a".repeat(64 * 1024));
  let enqueued = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      enqueued += chunk.byteLength;
      controller.enqueue(chunk);
    },
  });
  const request = new Request(
    "https://life.example/api/ingestion/publications/batches",
    {
      body: stream,
      // Node's fetch implementation requires an explicit duplex for streams.
      duplex: "half",
      headers: { "Content-Type": "application/json", ...headers },
      method: "POST",
    } as RequestInit,
  );
  return { enqueuedBytes: () => enqueued, request };
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

  it("refuses a batch whose declared size exceeds the memory budget", async () => {
    requirePrincipalMock.mockResolvedValue({
      kind: "service",
      serviceId: "publication-crawler",
      principalKey: PUBLICATION_INGESTION_PRINCIPAL_KEY,
    });
    const { request } = endlessPostRequest({
      "content-length": String(PUBLICATION_INGESTION_BATCH_MAX_BODY_BYTES + 1),
    });

    const response = await postPublicationIngestionBatchRoute(request);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: `Request body must not exceed ${PUBLICATION_INGESTION_BATCH_MAX_BODY_BYTES} bytes`,
    });
    // The oversized body is refused whole, never buffered and never partially
    // ingested: a partial batch that looks accepted is worse than a failure.
    expect(request.bodyUsed).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.ingestionBatch.findUnique).not.toHaveBeenCalled();
  });

  it("stops reading an undeclared batch body at the memory budget", async () => {
    requirePrincipalMock.mockResolvedValue({
      kind: "service",
      serviceId: "publication-crawler",
      principalKey: PUBLICATION_INGESTION_PRINCIPAL_KEY,
    });
    const { enqueuedBytes, request } = endlessPostRequest();

    const response = await postPublicationIngestionBatchRoute(request);

    expect(response.status).toBe(413);
    expect(enqueuedBytes()).toBeLessThan(
      PUBLICATION_INGESTION_BATCH_MAX_BODY_BYTES * 2,
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.ingestionBatch.findUnique).not.toHaveBeenCalled();
  });

  it("accepts the largest batch the crawler can emit", async () => {
    requirePrincipalMock.mockResolvedValue({
      kind: "service",
      serviceId: "publication-crawler",
      principalKey: PUBLICATION_INGESTION_PRINCIPAL_KEY,
    });
    // The crawler caps its own batches at DEFAULT_MAX_BATCH_BYTES (2 MiB) and
    // refuses to be configured higher, so the budget must clear that by a
    // wide margin or ingestion breaks.
    const CRAWLER_MAX_BATCH_BYTES = 2 * 1024 * 1024;
    expect(PUBLICATION_INGESTION_BATCH_MAX_BODY_BYTES).toBeGreaterThanOrEqual(
      CRAWLER_MAX_BATCH_BYTES * 2,
    );

    const padding = "x".repeat(CRAWLER_MAX_BATCH_BYTES);
    const body = {
      ...fixture,
      items: [{ ...fixture.items[0], bodyText: padding }],
    };
    const serialized = JSON.stringify(body);
    expect(serialized.length).toBeGreaterThan(CRAWLER_MAX_BATCH_BYTES);

    prismaMock.$transaction.mockRejectedValue(new Error("transaction reached"));

    const response = await postPublicationIngestionBatchRoute(
      postRequest(body),
    );

    // The body passed the budget and reached ingestion; only the stubbed
    // transaction stopped it.
    expect(response.status).not.toBe(413);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});
