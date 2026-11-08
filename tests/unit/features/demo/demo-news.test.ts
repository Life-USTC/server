import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  getDemoNewsDetail,
  getDemoNewsHomeNotices,
  getDemoNewsImage,
  getDemoNewsList,
  getDemoNewsObject,
  getDemoNewsSources,
} from "@/features/demo/server/demo-news";
import {
  collapsePublicationListSearchParams,
  publicationsQuerySchema,
} from "@/features/publications/lib/publication-read-request-schemas";

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Missing sealed news fixture");
  return value;
}
const sha = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");

for (const locale of ["en-us", "zh-cn"] as const) {
  describe(`sealed news graph: ${locale}`, () => {
    it("preserves the five Home notices and links each to its matching detail", () => {
      const titles =
        locale === "en-us"
          ? [
              "Sample reading room hours",
              "Sample study group registration",
              "Sample library workshop",
              "Sample campus walk",
              "Sample learning resources",
            ]
          : [
              "虚构阅览室开放时间",
              "虚构学习小组报名",
              "虚构图书馆工作坊",
              "虚构校园漫步",
              "虚构学习资源介绍",
            ];
      const notices = getDemoNewsHomeNotices(locale);
      expect(notices.map((notice) => notice.title)).toEqual(titles);
      expect(notices.map((notice) => notice.dateLabel)).toEqual([
        "2026-09-24",
        "2026-09-23",
        "2026-09-22",
        "2026-09-21",
        "2026-09-20",
      ]);
      notices.forEach((notice, index) => {
        expect(notice.key).toBe(`demo-notice-${index + 1}`);
        expect(notice.href).toBe(`/news/demo-news-${index + 1}`);
        expect(notice.meta).toBe(
          locale === "en-us"
            ? "Fictional demo sample · Not a school announcement"
            : "虚构演示样例 · 非学校通知",
        );
        expect(
          required(getDemoNewsDetail(locale, `demo-news-${index + 1}`)).revision
            .title,
        ).toBe(notice.title);
      });
    });

    it("paginates all 22 records and folds only the explicit reprint pair", () => {
      const first = required(getDemoNewsList(locale));
      const second = required(getDemoNewsList(locale, { page: 2 }));
      expect(first.pagination).toEqual({
        page: 1,
        pageSize: 20,
        total: 22,
        totalPages: 2,
      });
      expect(first.data).toHaveLength(20);
      expect(second.data.map((row) => row.id)).toEqual([
        "demo-news-21",
        "demo-news-22",
      ]);
      expect(
        new Set([...first.data, ...second.data].map((row) => row.id)).size,
      ).toBe(22);
      expect(
        [...first.data, ...second.data].every((row) => !row.foldGroup),
      ).toBe(true);
      const folded = required(getDemoNewsList(locale, { page: 2, fold: true }));
      expect(folded.pagination.total).toBe(21);
      expect(folded.data).toMatchObject([
        { id: "demo-news-21", foldGroup: { siblingCount: 1 } },
      ]);
      expect(
        required(getDemoNewsDetail(locale, "demo-news-21")).alsoPublishedIn.map(
          (row) => row.id,
        ),
      ).toEqual(["demo-news-22"]);
      expect(
        required(getDemoNewsDetail(locale, "demo-news-22")).alsoPublishedIn.map(
          (row) => row.id,
        ),
      ).toEqual(["demo-news-21"]);
      expect(
        required(getDemoNewsDetail(locale, "demo-news-1")).alsoPublishedIn,
      ).toEqual([]);
      const oneMember = required(
        getDemoNewsList(locale, { source: ["demo-center"], fold: true }),
      );
      expect(
        oneMember.data.find((row) => row.id === "demo-news-21")?.foldGroup,
      ).toBeUndefined();
    });

    it("keeps source counts and empty pagination consistent with the public reader", () => {
      const directory = getDemoNewsSources(locale);
      expect(directory.totals).toEqual({
        sourceCount: 4,
        publicationCount: 22,
      });
      const counts = Object.fromEntries(
        directory.groups.flatMap((group) =>
          group.sources.map((source) => [source.id, source.publicationCount]),
        ),
      );
      expect(counts).toEqual({
        "demo-study": 8,
        "demo-society": 7,
        "demo-center": 7,
        "demo-empty": 0,
      });
      for (const source of directory.groups.flatMap((group) => group.sources)) {
        expect(source.hosts).toEqual(["demo.invalid"]);
        expect(
          required(getDemoNewsList(locale, { source: [source.id] })).pagination
            .total,
        ).toBe(source.publicationCount);
        if (source.id === "demo-empty")
          expect(source.lastPublishedAt).toBeNull();
      }
      expect(
        required(getDemoNewsList(locale, { source: ["demo-empty"] })),
      ).toEqual({
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      });
    });

    it("uses the existing multi-value AND filters and first scalar value", () => {
      const params = new URLSearchParams(
        "source=demo-study&source=demo-society,demo-study&organizationLevel=student&organizationLevel=society&type=news&type=notice",
      );
      const query = publicationsQuerySchema.parse(
        Object.fromEntries(collapsePublicationListSearchParams(params)),
      );
      expect(query.source).toEqual(["demo-study", "demo-society"]);
      expect(query.type).toBe("news");
      const result = required(getDemoNewsList(locale, query));
      expect(result.data.length).toBeGreaterThan(0);
      expect(
        result.data.every(
          (row) =>
            row.publicationType === "news" &&
            ["demo-study", "demo-society"].includes(row.source.id),
        ),
      ).toBe(true);
      expect(
        required(
          getDemoNewsList(locale, {
            source: ["demo-study"],
            organizationLevel: ["center"],
          }),
        ).pagination.total,
      ).toBe(0);
      expect(
        required(
          getDemoNewsList(locale, { source: ["demo-study", "demo-society"] }),
        ).pagination.total,
      ).toBe(15);
    });

    it("searches summary fields without leaking full article bodies into list DTOs", () => {
      const title = locale === "en-us" ? "reading room" : "阅览室";
      expect(
        required(getDemoNewsList(locale, { query: title })).data.map(
          (row) => row.id,
        ),
      ).toEqual(["demo-news-1"]);
      const bodyOnly = required(
        getDemoNewsList(locale, {
          query: locale === "en-us" ? "Notebooks" : "笔记本",
        }),
      );
      expect(bodyOnly.data).toEqual([]);
      expect(bodyOnly.pagination.totalPages).toBe(1);
      for (const row of required(getDemoNewsList(locale)).data) {
        expect(row.revision).not.toHaveProperty("bodyMarkdown");
        expect(row).not.toHaveProperty("renderedBodyHtml");
      }
    });

    it("renders real Markdown tables and serves only revision-linked object bytes", () => {
      const detail = required(getDemoNewsDetail(locale, "demo-news-1"));
      expect(detail.renderedBodyHtml).toContain("<table");
      expect(detail.renderedBodyHtml).toContain(
        locale === "en-us" ? "Reading groups" : "学习小组",
      );
      expect(detail.revision.images).toHaveLength(1);
      expect(
        detail.revision.objects.map((object) => object.kind).sort(),
      ).toEqual(["asset", "body_markdown", "media"]);
      for (const object of detail.revision.objects) {
        const result = required(getDemoNewsObject(object.kind, object.sha256));
        expect(sha(result.bytes)).toBe(object.sha256);
        expect(result.bytes.byteLength).toBe(object.size);
        expect(result.contentType).toBe(object.contentType);
        if (object.kind === "body_markdown")
          expect(new TextDecoder().decode(result.bytes)).toBe(
            detail.revision.bodyMarkdown,
          );
        if (object.kind === "asset")
          expect(new TextDecoder().decode(result.bytes)).toContain(
            "不是学校通知",
          );
        expect(getDemoNewsObject("raw_page", object.sha256)).toBeNull();
        expect(getDemoNewsObject("body_html", object.sha256)).toBeNull();
      }
    });
  });
}

it("distinguishes URL identity from image content hash and returns independent bytes", () => {
  const id = sha("https://demo.invalid/images/fictional-demo-chart.png");
  const image = required(getDemoNewsImage(id));
  expect(image.sha256).toBe(sha(image.bytes));
  expect(image.contentType).toBe("image/png");
  expect([...image.bytes.slice(0, 8)]).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);
  const header = new DataView(
    image.bytes.buffer,
    image.bytes.byteOffset,
    image.bytes.byteLength,
  );
  expect([header.getUint32(16), header.getUint32(20)]).toEqual([320, 120]);
  expect(getDemoNewsImage(image.sha256)).toBeNull();
  expect(getDemoNewsObject("media", id)).toBeNull();
  expect(required(getDemoNewsObject("media", image.sha256)).bytes).toEqual(
    image.bytes,
  );
  image.bytes.fill(0);
  expect(required(getDemoNewsImage(id)).bytes[0]).toBe(137);
});

it("rejects foreign identifiers and invalid pagination without sharing mutable projections", () => {
  for (const id of ["", "real-news-1", "demo-news-23", "__proto__"])
    expect(getDemoNewsDetail("en-us", id)).toBeNull();
  for (const query of [
    { page: 0 },
    { page: 100001 },
    { pageSize: 0 },
    { pageSize: 51 },
    { source: ["ustc-news"] },
  ])
    expect(getDemoNewsList("en-us", query)).toBeNull();
  expect(getDemoNewsObject("asset", "0".repeat(64))).toBeNull();
  expect(getDemoNewsObject("unknown", "0".repeat(64))).toBeNull();
  expect(getDemoNewsImage("0".repeat(64))).toBeNull();
  const list = required(getDemoNewsList("en-us"));
  list.data[0].revision.title = "Private user data";
  list.data[0].source.name = "Private source";
  expect(required(getDemoNewsList("en-us")).data[0].revision.title).toBe(
    "Sample reading room hours",
  );
  expect(required(getDemoNewsDetail("en-us", "demo-news-1")).source.name).toBe(
    "Fictional study circle",
  );
});
