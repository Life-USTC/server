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

  it.each([
    ["/catalog/sections/[jwId]", "introduction"],
    ["/catalog/courses/[jwId]", "introduction"],
    ["/catalog/sections/[jwId]/homework", "homework"],
    ["/catalog/sections/[jwId]/calendar", "calendar"],
    ["/catalog/courses/[jwId]/comments", "comments"],
    ["/catalog/teachers/[id]/sections", "sections"],
    ["/catalog/teachers/[id]/calendar", "not_applicable"],
    ["/workspace", "not_applicable"],
    [null, "not_applicable"],
  ])("attributes %s to %s", (route, tab) => {
    expect(resolvePageCatalogDetailTab(route)).toBe(tab);
  });
});
