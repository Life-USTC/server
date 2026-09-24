import { describe, expect, it } from "vitest";
import {
  collapsePublicationListSearchParams,
  PUBLICATION_LIST_MAX_SOURCE_IDS,
  publicationImagePathParamsSchema,
  publicationObjectPathParamsSchema,
  publicationsQuerySchema,
} from "@/lib/api/schemas/request-publication-read-schemas";
import {
  publicPublicationDetailSchema,
  publicPublicationSourceDirectoryResponseSchema,
  publicPublicationSourceSchema,
  publicPublicationSourceSummarySchema,
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

  it("keeps a single source filter working while parsing it as a list", () => {
    const parsed = publicationsQuerySchema.parse({ source: "ustc-news" });
    expect(parsed.source).toEqual(["ustc-news"]);
  });

  it("parses comma-separated source and organization level lists", () => {
    const parsed = publicationsQuerySchema.parse({
      source: "ustc-news, jwc ,ustc-news",
      organizationLevel: "office,college",
    });
    // Duplicates collapse so a repeated pick cannot widen the IN list.
    expect(parsed.source).toEqual(["ustc-news", "jwc"]);
    expect(parsed.organizationLevel).toEqual(["office", "college"]);
  });

  it("rejects an invalid entry or an oversized list rather than dropping it", () => {
    expect(
      publicationsQuerySchema.safeParse({ source: "ustc-news,Bad Id" }).success,
    ).toBe(false);
    expect(
      publicationsQuerySchema.safeParse({ organizationLevel: "office,e2e" })
        .success,
    ).toBe(false);
    const tooMany = Array.from(
      { length: PUBLICATION_LIST_MAX_SOURCE_IDS + 1 },
      (_, index) => `source-${index}`,
    ).join(",");
    expect(publicationsQuerySchema.safeParse({ source: tooMany }).success).toBe(
      false,
    );
  });

  it("collapses the repeated params an HTML checkbox group submits", () => {
    const collapsed = collapsePublicationListSearchParams(
      new URLSearchParams(
        "source=a&source=b&organizationLevel=office&organizationLevel=college&type=news&query=%E6%8B%9B%E7%94%9F",
      ),
    );

    expect(collapsed.get("source")).toBe("a,b");
    expect(collapsed.get("organizationLevel")).toBe("office,college");
    expect(collapsed.get("type")).toBe("news");
    expect(collapsed.get("query")).toBe("招生");
    expect(
      publicationsQuerySchema.parse(Object.fromEntries(collapsed)).source,
    ).toEqual(["a", "b"]);
  });

  it("drops an empty repeated param instead of failing validation", () => {
    const collapsed = collapsePublicationListSearchParams(
      new URLSearchParams("source=&source=&type=news"),
    );
    expect(collapsed.has("source")).toBe(false);
    expect(
      publicationsQuerySchema.safeParse(Object.fromEntries(collapsed)).success,
    ).toBe(true);
  });

  it("describes the source directory as grouped registry entries", () => {
    const parsed = publicPublicationSourceDirectoryResponseSchema.parse({
      groups: [
        {
          organizationLevel: "university",
          sourceCount: 1,
          publicationCount: 12,
          sources: [
            {
              id: "ustc-news",
              name: "USTC News",
              organizationLevel: "university",
              hosts: ["news.ustc.edu.cn"],
              publicationCount: 12,
              lastPublishedAt: "2026-09-01T10:00:00+08:00",
            },
          ],
        },
      ],
      totals: { sourceCount: 1, publicationCount: 12 },
    });

    expect(parsed.groups[0].sources[0].hosts).toEqual(["news.ustc.edu.cn"]);
    // A level outside the registry vocabulary must not reach a client.
    expect(
      publicPublicationSourceDirectoryResponseSchema.safeParse({
        groups: [
          {
            organizationLevel: "e2e",
            sourceCount: 0,
            publicationCount: 0,
            sources: [],
          },
        ],
        totals: { sourceCount: 0, publicationCount: 0 },
      }).success,
    ).toBe(false);
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
      filename: null,
      sourceUrl: null,
    };
    const revision = {
      id: "revision-1",
      revisionHash: digest,
      observedAt: "2026-09-01T10:00:00+08:00",
      title: "Title",
      author: null,
      reporter: null,
      editor: null,
      originalPublisher: null,
      images: [],
      publishedAt: null,
      updatedAtSource: null,
      category: null,
      summary: null,
      sourcePageUrl: null,
      bodyText: "Plain body",
      bodyMarkdown: null,
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
      // The detail serializer always emits this, empty when the article has no
      // cross-section reprints, so the schema requires it rather than
      // defaulting it (issue #1068).
      alsoPublishedIn: [],
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
              reporter: revision.reporter,
              editor: revision.editor,
              originalPublisher: revision.originalPublisher,
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

  it("keeps the list and detail organizationLevel an open string", () => {
    // The directory is a new surface and documents the closed vocabulary, but
    // these two responses shipped organizationLevel as a free string. Pinning
    // them to an enum would hand generated clients an exhaustive type that a
    // future registry level breaks, so they stay open on purpose.
    const source = {
      id: "ustc-news",
      name: "USTC News",
      organizationLevel: "a-level-added-upstream-later",
    };
    expect(publicPublicationSourceSchema.safeParse(source).success).toBe(true);
    expect(
      publicPublicationSourceSummarySchema.safeParse({
        ...source,
        hosts: [],
        publicationCount: 0,
        lastPublishedAt: null,
      }).success,
    ).toBe(false);
  });

  it("validates publication image URL-hash paths", () => {
    expect(
      publicationImagePathParamsSchema.safeParse({ hash: digest }).success,
    ).toBe(true);
    expect(
      publicationImagePathParamsSchema.safeParse({ hash: digest.toUpperCase() })
        .success,
    ).toBe(false);
  });
});
