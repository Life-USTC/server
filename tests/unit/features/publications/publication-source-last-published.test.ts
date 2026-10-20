import { describe, expect, it } from "vitest";
import { publicationSourceLastPublishedLabel } from "@/features/publications/lib/publication-source-last-published";

describe("publicationSourceLastPublishedLabel", () => {
  const formatDate = (value: Date | string) =>
    typeof value === "string"
      ? value.slice(0, 10)
      : value.toISOString().slice(0, 10);

  it("formats a known last-published date", () => {
    expect(
      publicationSourceLastPublishedLabel(
        "2026-09-01T00:00:00+08:00",
        0,
        "暂无发布",
        formatDate,
      ),
    ).toBe("2026-09-01");
  });

  it("hides never-published copy when content already exists", () => {
    expect(
      publicationSourceLastPublishedLabel(null, 3, "暂无发布", formatDate),
    ).toBeNull();
  });

  it("keeps never-published copy for empty sources", () => {
    expect(
      publicationSourceLastPublishedLabel(null, 0, "暂无发布", formatDate),
    ).toBe("暂无发布");
  });
});
