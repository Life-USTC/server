import { describe, expect, it } from "vitest";
import { parsePublicationDateInput } from "@/features/publications/lib/publication-date";
import { publicationIngestionPayloadDigest } from "@/features/publications/server/publication-ingestion-service";
import { publicationIngestionBatchRequestSchema } from "@/lib/api/schemas/request-publication-ingestion-schemas";
import { PUBLIC_REST_FEATURES, REST_FEATURES } from "@/lib/oauth/constants";
import {
  CLIENT_REGISTRATION_ALLOWED_SCOPES,
  isMcpScope,
  OAUTH_PROVIDER_SCOPES,
  PUBLIC_OAUTH_SCOPES,
} from "@/lib/oauth/scope-registry";
import fixture from "../../docs/contracts/fixtures/publication-batch.json";

describe("publication ingestion contract", () => {
  it("accepts the shared camelCase crawler fixture", () => {
    const parsed = publicationIngestionBatchRequestSchema.safeParse(fixture);
    expect(parsed.success).toBe(true);
  });

  it("accepts the minimal source descriptor form", () => {
    const parsed = publicationIngestionBatchRequestSchema.safeParse({
      ...fixture,
      sources: [{ id: "ustc-news", name: "USTC News" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("keeps bare MIME types and rejects signed Content-Type parameters", () => {
    const base = {
      ...fixture,
      items: [
        {
          ...fixture.items[0],
          objects: [
            {
              kind: "body_html",
              sha256:
                "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              size: 4,
              contentType: "text/html",
            },
          ],
        },
      ],
    };
    expect(publicationIngestionBatchRequestSchema.safeParse(base).success).toBe(
      true,
    );
    expect(
      publicationIngestionBatchRequestSchema.safeParse({
        ...base,
        items: [
          {
            ...base.items[0],
            objects: [
              {
                ...base.items[0].objects[0],
                contentType: "text/html; charset=utf-8",
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects non-HTTP source and publication URLs", () => {
    expect(
      publicationIngestionBatchRequestSchema.safeParse({
        ...fixture,
        sources: [
          { ...fixture.sources[0], seedUrls: ["ftp://news.ustc.edu.cn/"] },
        ],
      }).success,
    ).toBe(false);
    expect(
      publicationIngestionBatchRequestSchema.safeParse({
        ...fixture,
        items: [
          { ...fixture.items[0], canonicalUrl: "ftp://news.ustc.edu.cn/item" },
        ],
      }).success,
    ).toBe(false);
  });

  it("caps one object manifest at the first-slice 32 MiB limit", () => {
    const manifest = {
      kind: "body_html",
      sha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      size: 32 * 1024 * 1024,
      contentType: "text/html",
    };
    const accepted = publicationIngestionBatchRequestSchema.safeParse({
      ...fixture,
      items: [{ ...fixture.items[0], objects: [manifest] }],
    });
    expect(accepted.success).toBe(true);
    expect(
      publicationIngestionBatchRequestSchema.safeParse({
        ...fixture,
        items: [
          {
            ...fixture.items[0],
            objects: [{ ...manifest, size: manifest.size + 1 }],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("interprets publication date-only and naive timestamps in Shanghai", () => {
    expect(parsePublicationDateInput("2026-09-01")?.toISOString()).toBe(
      "2026-08-31T16:00:00.000Z",
    );
    expect(
      parsePublicationDateInput("2026-09-01T00:00:00")?.toISOString(),
    ).toBe("2026-08-31T16:00:00.000Z");
    expect(
      parsePublicationDateInput("2026-09-01T00:00:00+08:00")?.toISOString(),
    ).toBe("2026-08-31T16:00:00.000Z");
  });

  it("digests equivalent payloads independent of object key order", async () => {
    const parsed = publicationIngestionBatchRequestSchema.parse(fixture);
    const reordered = {
      items: parsed.items,
      sources: parsed.sources,
      observedAt: parsed.observedAt,
      batchId: parsed.batchId,
      clientRunId: parsed.clientRunId,
      producerVersion: parsed.producerVersion,
      protocolVersion: parsed.protocolVersion,
    };
    await expect(publicationIngestionPayloadDigest(parsed)).resolves.toBe(
      await publicationIngestionPayloadDigest(reordered),
    );
  });

  it("keeps ingestion REST-only and out of public/DCR/MCP scopes", () => {
    expect(REST_FEATURES).toContain("publication.ingest");
    expect(PUBLIC_REST_FEATURES).not.toContain("publication.ingest");
    expect(PUBLIC_OAUTH_SCOPES).not.toContain("publication.ingest:write");
    expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).not.toContain(
      "publication.ingest:write",
    );
    expect(OAUTH_PROVIDER_SCOPES).toContain("publication.ingest:write");
    expect(isMcpScope("publication.ingest:write")).toBe(false);
  });
});
