import { describe, expect, it } from "vitest";
import { parsePublicationDateInput } from "@/features/publications/lib/publication-date";
import { PUBLICATION_INGESTION_BATCH_MAX_ITEMS } from "@/features/publications/lib/publication-ingestion-limits";
import { publicationIngestionPayloadDigest } from "@/features/publications/server/publication-ingestion-service";
import {
  publicationIngestionBatchRequestSchema,
  publicationObjectPlanRequestSchema,
  publicationObjectUploadParamsSchema,
} from "@/lib/api/schemas/request-publication-ingestion-schemas";
import { publicationIngestionBatchResponseSchema } from "@/lib/api/schemas/response-publication-ingestion-schemas";
import { PUBLICATION_INGESTION_SECRET_HEADER } from "@/lib/auth/publication-ingestion-auth";
import { PUBLICATION_INGESTION_PRINCIPAL_KEY } from "@/lib/auth/service-principal";
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

  it("accepts 100 items and rejects 101", () => {
    expect(PUBLICATION_INGESTION_BATCH_MAX_ITEMS).toBe(100);
    const items = Array.from(
      { length: PUBLICATION_INGESTION_BATCH_MAX_ITEMS },
      (_, index) => ({
        ...fixture.items[0],
        canonicalUrl: `https://news.ustc.edu.cn/example/${index}.html`,
        revisionHash: index.toString(16).padStart(64, "0"),
      }),
    );
    expect(
      publicationIngestionBatchRequestSchema.safeParse({ ...fixture, items })
        .success,
    ).toBe(true);
    const oversizedItems = [
      ...items,
      {
        ...items[0],
        canonicalUrl: "https://news.ustc.edu.cn/example/101.html",
        revisionHash: "f".repeat(64),
      },
    ];
    expect(
      publicationIngestionBatchRequestSchema.safeParse({
        ...fixture,
        items: oversizedItems,
      }).success,
    ).toBe(false);
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

  it.each([
    {
      label: "batch metadata",
      path: ["producerVersion"],
      payload: { producerVersion: "crawler\u0000/1" },
    },
    {
      label: "source descriptor",
      path: ["sources", 0, "name"],
      payload: {
        sources: [{ ...fixture.sources[0], name: "USTC\u0000 News" }],
      },
    },
    {
      label: "publication title",
      path: ["items", 0, "title"],
      payload: {
        items: [{ ...fixture.items[0], title: "Fixture\u0000 publication" }],
      },
    },
    {
      label: "publication author",
      path: ["items", 0, "author"],
      payload: {
        items: [{ ...fixture.items[0], author: "Author\u0000" }],
      },
    },
    {
      label: "publication body",
      path: ["items", 0, "bodyText"],
      payload: {
        items: [{ ...fixture.items[0], bodyText: "Fixture body\u0000" }],
      },
    },
    {
      label: "object metadata",
      path: ["items", 0, "objects", 0, "altText"],
      payload: {
        items: [
          {
            ...fixture.items[0],
            objects: [
              {
                kind: "media",
                sha256: "b".repeat(64),
                size: 4,
                contentType: "image/png",
                altText: "Campus\u0000 image",
              },
            ],
          },
        ],
      },
    },
    {
      label: "nested raw metadata",
      path: ["items", 0, "rawMetadata", "authors", 1, "name"],
      payload: {
        items: [
          {
            ...fixture.items[0],
            rawMetadata: {
              authors: [{ name: "张三" }, { name: "李四\u0000" }],
            },
          },
        ],
      },
    },
    {
      label: "raw metadata key",
      path: ["items", 0, "rawMetadata", "[invalid-string]"],
      payload: {
        items: [
          {
            ...fixture.items[0],
            rawMetadata: { "author\u0000": "李四" },
          },
        ],
      },
    },
  ])("rejects NUL characters in $label", ({ path, payload }) => {
    const parsed = publicationIngestionBatchRequestSchema.safeParse({
      ...fixture,
      ...payload,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues).toContainEqual(
        expect.objectContaining({
          message: "NUL characters are not allowed",
          path,
        }),
      );
    }
  });

  it("accepts ordinary Unicode and trims whitespace without rejecting it", () => {
    const parsed = publicationIngestionBatchRequestSchema.parse({
      ...fixture,
      producerVersion: "  爬虫 / 1  ",
      sources: [{ ...fixture.sources[0], name: "  中国科大新闻  " }],
      items: [
        {
          ...fixture.items[0],
          title: "  校园通知  ",
          bodyText: "第一段\n第二段  ",
          rawMetadata: { authors: ["张三", { note: "含有中文" }] },
        },
      ],
    });

    expect(parsed.producerVersion).toBe("爬虫 / 1");
    expect(parsed.sources[0]?.name).toBe("中国科大新闻");
    const item = parsed.items[0];
    expect(item?.tombstone).toBe(false);
    if (item && !item.tombstone) {
      expect(item.title).toBe("校园通知");
      expect(item.bodyText).toBe("第一段\n第二段  ");
    }
  });

  it.each([
    {
      label: "object plan",
      schema: publicationObjectPlanRequestSchema,
      payload: {
        batchId: "fixture\u0000batch",
        objects: [{ kind: "body_html", sha256: "a".repeat(64) }],
      },
    },
    {
      label: "object upload path",
      schema: publicationObjectUploadParamsSchema,
      payload: {
        batchId: "fixture\u0000batch",
        kind: "body_html",
        sha256: "a".repeat(64),
      },
    },
  ])("rejects NUL characters in $label requests", ({ schema, payload }) => {
    const parsed = schema.safeParse(payload);

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues).toContainEqual(
        expect.objectContaining({
          message: "NUL characters are not allowed",
          path: ["batchId"],
        }),
      );
    }
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

  it("requires a canonical SHA-256 payload digest in batch responses", () => {
    const response = {
      batchId: fixture.batchId,
      clientRunId: fixture.clientRunId,
      payloadDigest: "a".repeat(64),
      results: [],
    };
    expect(
      publicationIngestionBatchResponseSchema.safeParse(response).success,
    ).toBe(true);
    expect(
      publicationIngestionBatchResponseSchema.safeParse({
        ...response,
        payloadDigest: "not-a-digest",
      }).success,
    ).toBe(false);
  });

  it("keeps ingestion outside the OAuth feature and scope registries", () => {
    expect(REST_FEATURES).not.toContain("publication.ingest");
    expect(PUBLIC_REST_FEATURES).not.toContain("publication.ingest");
    expect(PUBLIC_OAUTH_SCOPES).not.toContain("publication.ingest:write");
    expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).not.toContain(
      "publication.ingest:write",
    );
    expect(OAUTH_PROVIDER_SCOPES).not.toContain("publication.ingest:write");
    expect(isMcpScope("publication.ingest:write")).toBe(false);
  });

  it("uses a dedicated service secret and stable service principal key", () => {
    expect(PUBLICATION_INGESTION_SECRET_HEADER).toBe(
      "X-Publication-Ingestion-Secret",
    );
    expect(PUBLICATION_INGESTION_PRINCIPAL_KEY).toBe(
      "service:publication-crawler",
    );
  });
});
