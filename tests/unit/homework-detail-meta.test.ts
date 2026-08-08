import { describe, expect, it, vi } from "vitest";
import {
  buildHomeworkDetailMetaRows,
  buildHomeworkDetailTags,
} from "@/features/homeworks/lib/homework-detail-meta";

const labels = {
  publishedAt: "Published",
  submissionDue: "Submission due",
  submissionStart: "Submission start",
};

const tagLabels = {
  tagMajor: "Major assignment",
  tagTeam: "Team required",
};

function formatDate(value: Date | string | null | undefined) {
  return value ? `formatted:${String(value)}` : "TBD";
}

describe("buildHomeworkDetailMetaRows", () => {
  it("orders cells from publish date through the submission window", () => {
    const rows = buildHomeworkDetailMetaRows({
      formatDate,
      homework: {
        publishedAt: "2026-06-01T00:00:00Z",
        submissionDueAt: "2026-06-20T00:00:00Z",
        submissionStartAt: "2026-06-10T00:00:00Z",
      },
      labels,
    });

    expect(rows.map((row) => row.key)).toEqual([
      "publishedAt",
      "submissionStartAt",
      "submissionDueAt",
    ]);
    expect(rows.map((row) => row.label)).toEqual([
      "Published",
      "Submission start",
      "Submission due",
    ]);
    expect(rows.map((row) => row.value)).toEqual([
      "formatted:2026-06-01T00:00:00Z",
      "formatted:2026-06-10T00:00:00Z",
      "formatted:2026-06-20T00:00:00Z",
    ]);
  });

  it("emphasizes only the due cell", () => {
    const rows = buildHomeworkDetailMetaRows({
      formatDate,
      homework: {},
      labels,
    });

    expect(rows.filter((row) => row.emphasis).map((row) => row.key)).toEqual([
      "submissionDueAt",
    ]);
  });

  it("formats missing dates through the caller's formatter", () => {
    const formatter = vi.fn(formatDate);

    const rows = buildHomeworkDetailMetaRows({
      formatDate: formatter,
      homework: { submissionDueAt: null },
      labels,
    });

    expect(formatter).toHaveBeenCalledTimes(3);
    expect(formatter).toHaveBeenCalledWith(undefined);
    expect(formatter).toHaveBeenCalledWith(null);
    expect(rows.map((row) => row.value)).toEqual(["TBD", "TBD", "TBD"]);
  });

  it("keeps a trimmed due hint and drops blank hints", () => {
    const withHint = buildHomeworkDetailMetaRows({
      dueHint: "  in 3 days  ",
      formatDate,
      homework: {},
      labels,
    });
    const withBlankHint = buildHomeworkDetailMetaRows({
      dueHint: "   ",
      formatDate,
      homework: {},
      labels,
    });
    const withoutHint = buildHomeworkDetailMetaRows({
      formatDate,
      homework: {},
      labels,
    });

    expect(withHint.map((row) => row.hint)).toEqual([null, null, "in 3 days"]);
    expect(withBlankHint.map((row) => row.hint)).toEqual([null, null, null]);
    expect(withoutHint.map((row) => row.hint)).toEqual([null, null, null]);
  });
});

describe("buildHomeworkDetailTags", () => {
  it("returns nothing when no flag is set", () => {
    expect(
      buildHomeworkDetailTags({
        homework: { isMajor: false, requiresTeam: false },
        labels: tagLabels,
      }),
    ).toEqual([]);
    expect(
      buildHomeworkDetailTags({
        homework: { isMajor: null, requiresTeam: undefined },
        labels: tagLabels,
      }),
    ).toEqual([]);
  });

  it("lists major before team as one uniform chip group", () => {
    expect(
      buildHomeworkDetailTags({
        homework: { isMajor: true, requiresTeam: true },
        labels: tagLabels,
      }),
    ).toEqual([
      { key: "major", label: "Major assignment", variant: "secondary" },
      { key: "team", label: "Team required", variant: "secondary" },
    ]);
  });

  it("includes only the flags that are set", () => {
    expect(
      buildHomeworkDetailTags({
        homework: { isMajor: true },
        labels: tagLabels,
      }).map((tag) => tag.key),
    ).toEqual(["major"]);
    expect(
      buildHomeworkDetailTags({
        homework: { requiresTeam: true },
        labels: tagLabels,
      }).map((tag) => tag.key),
    ).toEqual(["team"]);
  });
});
