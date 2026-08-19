import { describe, expect, it, vi } from "vitest";
import {
  buildHomeworkDetailTags,
  buildHomeworkDueSummary,
  buildHomeworkMetadataRows,
  homeworkCompletionStatusLabel,
} from "@/features/homeworks/lib/homework-detail-meta";

const statusLabels = {
  completedStatus: "Completed",
  incompleteStatus: "Incomplete",
};

const metaLabels = {
  publishedAt: "Published",
  submissionStart: "Submission opens",
};

const tagLabels = {
  tagMajor: "Major assignment",
  tagTeam: "Team required",
};

function formatDate(value: Date | string | null | undefined) {
  return value ? `formatted:${String(value)}` : "TBD";
}

describe("homeworkCompletionStatusLabel", () => {
  it("reports completion status rather than a homework attribute", () => {
    expect(homeworkCompletionStatusLabel(true, statusLabels)).toBe("Completed");
    expect(homeworkCompletionStatusLabel(false, statusLabels)).toBe(
      "Incomplete",
    );
  });
});

describe("buildHomeworkDueSummary", () => {
  it("carries the due date, status and relative label as primary properties", () => {
    expect(
      buildHomeworkDueSummary({
        completed: false,
        dueLabel: "Submission due",
        etaLabel: "in 3 days",
        formatDate,
        homework: { submissionDueAt: "2026-06-20T00:00:00Z" },
        statusLabel: "Incomplete",
      }),
    ).toEqual({
      completed: false,
      dueLabel: "Submission due",
      dueValue: "formatted:2026-06-20T00:00:00Z",
      etaLabel: "in 3 days",
      statusLabel: "Incomplete",
    });
  });

  it("formats a missing due date through the caller's formatter", () => {
    const formatter = vi.fn(formatDate);

    const summary = buildHomeworkDueSummary({
      completed: true,
      dueLabel: "Submission due",
      formatDate: formatter,
      homework: {},
      statusLabel: "Completed",
    });

    expect(formatter).toHaveBeenCalledWith(undefined);
    expect(summary.dueValue).toBe("TBD");
    expect(summary.completed).toBe(true);
  });

  it("keeps a trimmed relative label and drops blank ones", () => {
    const trimmed = buildHomeworkDueSummary({
      completed: false,
      dueLabel: "Submission due",
      etaLabel: "  overdue  ",
      formatDate,
      homework: {},
      statusLabel: "Incomplete",
    });
    const blank = buildHomeworkDueSummary({
      completed: false,
      dueLabel: "Submission due",
      etaLabel: "   ",
      formatDate,
      homework: {},
      statusLabel: "Incomplete",
    });
    const missing = buildHomeworkDueSummary({
      completed: false,
      dueLabel: "Submission due",
      formatDate,
      homework: {},
      statusLabel: "Incomplete",
    });

    expect(trimmed.etaLabel).toBe("overdue");
    expect(blank.etaLabel).toBeNull();
    expect(missing.etaLabel).toBeNull();
  });
});

describe("buildHomeworkMetadataRows", () => {
  it("lists the publication date before the submission window opens", () => {
    const rows = buildHomeworkMetadataRows({
      formatDate,
      homework: {
        publishedAt: "2026-06-01T00:00:00Z",
        submissionStartAt: "2026-06-10T00:00:00Z",
      },
      labels: metaLabels,
    });

    expect(rows).toEqual([
      {
        key: "publishedAt",
        label: "Published",
        value: "formatted:2026-06-01T00:00:00Z",
      },
      {
        key: "submissionStartAt",
        label: "Submission opens",
        value: "formatted:2026-06-10T00:00:00Z",
      },
    ]);
  });

  it("excludes the due date and platform timestamps", () => {
    const rows = buildHomeworkMetadataRows({
      formatDate,
      homework: {
        createdAt: "2026-05-01T00:00:00Z",
        submissionDueAt: "2026-06-20T00:00:00Z",
      } as Parameters<typeof buildHomeworkMetadataRows>[0]["homework"],
      labels: metaLabels,
    });

    expect(rows.map((row) => row.key)).toEqual([
      "publishedAt",
      "submissionStartAt",
    ]);
    expect(rows.every((row) => row.value === "TBD")).toBe(true);
  });
});

describe("buildHomeworkDetailTags", () => {
  it("returns nothing for standard homework", () => {
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

  it("lists major before team", () => {
    expect(
      buildHomeworkDetailTags({
        homework: { isMajor: true, requiresTeam: true },
        labels: tagLabels,
      }),
    ).toEqual([
      { key: "major", label: "Major assignment" },
      { key: "team", label: "Team required" },
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
