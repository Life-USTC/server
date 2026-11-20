import { describe, expect, it } from "vitest";
import {
  resolveSectionDetailTabQueryRedirect,
  sectionDetailHomeworkPath,
  sectionDetailPagePath,
} from "@/features/section-detail/lib/section-detail-tab";

function request(path: string, method = "GET") {
  return new Request(`https://life-ustc.test${path}`, { method });
}

describe("section detail paths", () => {
  it.each([
    [301, undefined, "/catalog/sections/301"],
    [301, "overview", "/catalog/sections/301/overview"],
    [301, "introduction", "/catalog/sections/301/introduction"],
    [301, "calendar", "/catalog/sections/301/calendar"],
    [301, "homework", "/catalog/sections/301/homework"],
    [301, "comments", "/catalog/sections/301/comments"],
  ] as const)("builds canonical path for tab %s", (jwId, tab, expected) => {
    expect(sectionDetailPagePath(jwId, tab)).toBe(expected);
  });

  it("builds homework deep links without tab query", () => {
    expect(sectionDetailHomeworkPath(301)).toBe(
      "/catalog/sections/301/homework",
    );
    expect(sectionDetailHomeworkPath(301, { homeworkId: "hw-1" })).toBe(
      "/catalog/sections/301/homework?homeworkId=hw-1",
    );
  });
});

describe("section detail redirects", () => {
  it.each([
    [
      "/catalog/sections/159446?tab=overview",
      "/catalog/sections/159446/overview",
    ],
    [
      "/catalog/sections/159446?tab=calendar",
      "/catalog/sections/159446/calendar",
    ],
    [
      "/catalog/sections/159446?tab=calendar&page=2",
      "/catalog/sections/159446/calendar?page=2",
    ],
  ])("strips tab query %s to canonical URL", (path, target) => {
    expect(resolveSectionDetailTabQueryRedirect(request(path))).toBe(target);
  });

  it("ignores non-section routes", () => {
    expect(
      resolveSectionDetailTabQueryRedirect(
        request("/catalog/courses/42/introduction"),
      ),
    ).toBeNull();
  });
});
