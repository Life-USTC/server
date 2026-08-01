import { describe, expect, it } from "vitest";
import {
  classifyPageAuthSignalPresence,
  classifyPageSsrClass,
  resolvePageCatalogDetailTab,
} from "@/lib/metrics/page-request-attribution";

describe("page request attribution", () => {
  it("classifies public-ssr vs dynamic-ssr from the hook publicSsr marker", () => {
    expect(classifyPageSsrClass(true)).toBe("public-ssr");
    expect(classifyPageSsrClass(false)).toBe("dynamic-ssr");
  });

  it("classifies auth signal presence without session resolution", () => {
    expect(classifyPageAuthSignalPresence(true)).toBe("present");
    expect(classifyPageAuthSignalPresence(false)).toBe("absent");
  });

  it("resolves section detail tabs from the canonical query param only", () => {
    const url = new URL(
      "https://life.example/catalog/sections/12345?tab=calendar",
    );

    expect(resolvePageCatalogDetailTab("/catalog/sections/[jwId]", url)).toBe(
      "calendar",
    );
    expect(
      resolvePageCatalogDetailTab("/catalog/sections/[jwId]", url, {
        section: "introduction",
      }),
    ).toBe("calendar");
  });

  it("defaults section and course detail routes without tabs to overview", () => {
    expect(
      resolvePageCatalogDetailTab(
        "/catalog/sections/[jwId]",
        new URL("https://life.example/catalog/sections/12345"),
      ),
    ).toBe("overview");
    expect(
      resolvePageCatalogDetailTab(
        "/catalog/courses/[jwId]",
        new URL("https://life.example/catalog/courses/42"),
      ),
    ).toBe("overview");
    expect(
      resolvePageCatalogDetailTab(
        "/catalog/teachers/[id]",
        new URL("https://life.example/catalog/teachers/7"),
      ),
    ).toBe("overview");
  });

  it("resolves course and teacher detail tabs from route params", () => {
    expect(
      resolvePageCatalogDetailTab(
        "/catalog/courses/[jwId]/[section]",
        new URL("https://life.example/catalog/courses/42/comments"),
        { section: "comments" },
      ),
    ).toBe("comments");
    expect(
      resolvePageCatalogDetailTab(
        "/catalog/teachers/[id]/[section]",
        new URL("https://life.example/catalog/teachers/7/sections"),
        { section: "sections" },
      ),
    ).toBe("sections");
  });

  it("returns not_applicable for non-catalog detail routes", () => {
    expect(
      resolvePageCatalogDetailTab(
        "/workspace",
        new URL("https://life.example/workspace"),
      ),
    ).toBe("not_applicable");
    expect(
      resolvePageCatalogDetailTab(null, new URL("https://life.example/")),
    ).toBe("not_applicable");
  });
});
