import { describe, expect, it } from "vitest";
import {
  publicationDetailHref,
  publicationListHref,
  publicationReturnHref,
} from "@/features/publications/lib/publication-page-navigation";

describe("publication page navigation", () => {
  it("round-trips all filters and the page through article links", () => {
    const list = publicationListHref(
      {
        type: "notice",
        source: ["ustc-news", "ustc-office"],
        organizationLevel: ["university", "office"],
        query: "报名 & 校园",
        fold: true,
      },
      3,
    );
    const detail = new URL(
      publicationDetailHref("article/1", list),
      "https://example.test",
    );
    expect(detail.pathname).toBe("/news/article%2F1");
    const returned = publicationReturnHref(detail.searchParams.get("from"));
    expect(returned).toBe(list);
    const params = new URL(returned, "https://example.test").searchParams;
    expect(Object.fromEntries(params)).toEqual({
      type: "notice",
      source: "ustc-news,ustc-office",
      organizationLevel: "university,office",
      query: "报名 & 校园",
      fold: "1",
      page: "3",
    });
  });

  it("omits removed filters and resets page when switching a facet", () => {
    expect(
      publicationListHref({ source: [], organizationLevel: [], fold: false }),
    ).toBe("/news");
    expect(publicationListHref({ type: "news", source: ["one"] })).toBe(
      "/news?type=news&source=one",
    );
  });

  it.each([
    null,
    "",
    "https://elsewhere.test/news",
    "//elsewhere.test/news",
    "/news/123",
    "/newsroom",
    "javascript:alert(1)",
    "/news\\evil",
  ])("rejects a non-list return destination: %s", (value) => {
    expect(publicationReturnHref(value)).toBe("/news");
  });

  it("removes the fragment while preserving an encoded search value", () => {
    expect(
      publicationReturnHref("/news?query=%23%E6%8A%A5%E5%90%8D&page=2#outside"),
    ).toBe("/news?query=%23%E6%8A%A5%E5%90%8D&page=2");
  });
});
