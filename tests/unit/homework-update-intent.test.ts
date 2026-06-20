import { describe, expect, test } from "vitest";
import {
  buildHomeworkUpdateIntent,
  hasHomeworkUpdateIntentChanges,
} from "@/features/homeworks/server/homework-update-intent";

const emptyDates = {
  hasPublishedAt: false,
  hasSubmissionDueAt: false,
  hasSubmissionStartAt: false,
  publishedAt: undefined,
  submissionDueAt: undefined,
  submissionStartAt: undefined,
};

describe("buildHomeworkUpdateIntent", () => {
  test("keeps empty updates explicit", () => {
    const intent = buildHomeworkUpdateIntent({
      dates: emptyDates,
      hasDescription: false,
      userId: "user-1",
    });

    expect(hasHomeworkUpdateIntentChanges(intent)).toBe(false);
    expect(intent.description).toBeUndefined();
    expect(intent.homeworkUpdates).toBeUndefined();
  });

  test("represents description-only updates without homework row data", () => {
    const intent = buildHomeworkUpdateIntent({
      dates: emptyDates,
      description: "updated description",
      hasDescription: true,
      userId: "user-1",
    });

    expect(hasHomeworkUpdateIntentChanges(intent)).toBe(true);
    expect(intent.description).toBe("updated description");
    expect(intent.homeworkUpdates).toBeUndefined();
  });

  test("adds editor metadata only when homework row data changes", () => {
    const dueAt = new Date("2026-05-15T15:00:00.000Z");
    const intent = buildHomeworkUpdateIntent({
      dates: {
        ...emptyDates,
        hasSubmissionDueAt: true,
        submissionDueAt: dueAt,
      },
      hasDescription: false,
      requiresTeam: true,
      title: "updated homework",
      userId: "user-1",
    });

    expect(intent.description).toBeUndefined();
    expect(intent.homeworkUpdates).toMatchObject({
      requiresTeam: true,
      submissionDueAt: dueAt,
      title: "updated homework",
      updatedBy: { connect: { id: "user-1" } },
    });
  });
});
