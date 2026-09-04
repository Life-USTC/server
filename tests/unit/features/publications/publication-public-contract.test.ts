import { describe, expect, it } from "vitest";
import {
  publicationObjectPathParamsSchema,
  publicationsQuerySchema,
} from "@/lib/api/schemas/request-publication-read-schemas";
import {
  publicPublicationDetailSchema,
  publicPublicationsResponseSchema,
} from "@/lib/api/schemas/response-publication-read-schemas";

const digest = "a".repeat(64);

describe("public publication contract", () => {
  it("accepts public filters but never accepts other as a read type", () => {
    expect(
      publicationsQuerySchema.safeParse({
        type: "notice",
        source: "ustc-news",
        query: "招生",
      }).success,
    ).toBe(true);
    expect(publicationsQuerySchema.safeParse({ type: "other" }).success).toBe(
      false,
    );
  });

  it("validates content-addressed object paths", () => {
    expect(
      publicationObjectPathParamsSchema.safeParse({
        kind: "media",
        sha256: digest,
      }).success,
    ).toBe(true);
    expect(
      publicationObjectPathParamsSchema.safeParse({
        kind: "media",
        sha256: digest.toUpperCase(),
      }).success,
    ).toBe(false);
  });

  it("keeps the detail object links nested under the current revision", () => {
    const object = {
      kind: "media",
      sha256: digest,
      size: 3,
      contentType: "image/png",
      status: "linked",
      url: `/api/publications/objects/media/${digest}`,
      sortOrder: 0,
      altText: null,
    };
    const revision = {
      id: "revision-1",
      revisionHash: digest,
      observedAt: "2026-09-01T10:00:00+08:00",
      title: "Title",
      author: null,
      publishedAt: null,
      updatedAtSource: null,
      category: null,
      summary: null,
      sourcePageUrl: null,
      bodyText: "Plain body",
      extractionMethod: null,
      classifierVersion: null,
      objects: [object],
    };
    const detail = {
      id: "publication-1",
      canonicalUrl: "https://news.ustc.edu.cn/item",
      publicationType: "news",
      source: {
        id: "ustc-news",
        name: "USTC News",
        organizationLevel: "university",
      },
      revision,
    };

    expect(
      publicPublicationDetailSchema.parse(detail).revision.objects,
    ).toHaveLength(1);
    expect(
      publicPublicationsResponseSchema.parse({
        data: [
          {
            id: detail.id,
            canonicalUrl: detail.canonicalUrl,
            publicationType: detail.publicationType,
            source: detail.source,
            revision: {
              id: revision.id,
              revisionHash: revision.revisionHash,
              observedAt: revision.observedAt,
              title: revision.title,
              author: revision.author,
              publishedAt: revision.publishedAt,
              updatedAtSource: revision.updatedAtSource,
              category: revision.category,
              summary: revision.summary,
              sourcePageUrl: revision.sourcePageUrl,
            },
            objects: [object],
          },
        ],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      }).data[0].revision.title,
    ).toBe("Title");
  });
});
