import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import {
  attachHomeworkCompletionRequired,
  completionRequiredForSubscriptionKind,
  isHomeworkPendingForViewer,
} from "@/features/homeworks/lib/homework-completion-state";
import { homeworkExpectation } from "../../../shared/specifications/homework";
import { semanticContract } from "../../../shared/specifications/semantic-contract";

const referenceDate = new Date("2026-09-13T12:00:00.000Z");

describe("homework completion requirement", () => {
  it("derives the requirement from the viewer's subscription kind", () => {
    expect(completionRequiredForSubscriptionKind("regular")).toBe(true);
    expect(completionRequiredForSubscriptionKind("auditor")).toBe(true);
    expect(completionRequiredForSubscriptionKind("teaching_assistant")).toBe(
      false,
    );
    expect(completionRequiredForSubscriptionKind(undefined)).toBe(true);
  });

  it("attaches a requirement per section without changing homework records", () => {
    const homeworks = [
      { id: "regular", sectionId: 1, completion: null },
      { id: "ta", sectionId: 2, completion: { completedAt: referenceDate } },
      { id: "unknown", sectionId: 3, completion: null },
    ];

    expect(
      attachHomeworkCompletionRequired(
        homeworks,
        new Map([
          [1, "regular"],
          [2, "teaching_assistant"],
        ]),
      ),
    ).toEqual([
      {
        id: "regular",
        sectionId: 1,
        completion: null,
        completionRequired: true,
      },
      {
        id: "ta",
        sectionId: 2,
        completion: { completedAt: referenceDate },
        completionRequired: false,
      },
      {
        id: "unknown",
        sectionId: 3,
        completion: null,
        completionRequired: true,
      },
    ]);
  });
});

describe("teaching assistant pending scope", () => {
  it.each([
    {
      name: "has no deadline",
      homework: { completionRequired: false, submissionDueAt: null },
      pending: true,
    },
    {
      name: "is before its deadline",
      homework: {
        completionRequired: false,
        submissionDueAt: "2026-09-13T12:00:00.001Z",
      },
      pending: true,
    },
    {
      name: "is exactly at its deadline",
      homework: {
        completionRequired: false,
        submissionDueAt: "2026-09-13T12:00:00.000Z",
      },
      pending: false,
    },
    {
      name: "is after its deadline",
      homework: {
        completionRequired: false,
        submissionDueAt: "2026-09-13T11:59:59.999Z",
      },
      pending: false,
    },
  ])("keeps TA homework pending when it is $name", ({ homework, pending }) => {
    expect(isHomeworkPendingForViewer(homework, referenceDate)).toBe(pending);
  });

  it("preserves actual completion as the first pending filter", () => {
    expect(
      isHomeworkPendingForViewer(
        {
          completion: { completedAt: referenceDate },
          completionRequired: false,
          submissionDueAt: "2026-09-13T13:00:00.000Z",
        },
        referenceDate,
      ),
    ).toBe(false);
    expect(
      isHomeworkPendingForViewer(
        {
          homeworkCompletions: [{ completedAt: referenceDate }],
          completionRequired: false,
          submissionDueAt: "2026-09-13T13:00:00.000Z",
        },
        referenceDate,
      ),
    ).toBe(false);
  });

  it("keeps regular incomplete homework pending regardless of deadline", () => {
    expect(
      isHomeworkPendingForViewer(
        {
          completionRequired: true,
          submissionDueAt: "2026-09-13T11:59:59.999Z",
        },
        referenceDate,
      ),
    ).toBe(true);
  });
});

it("homework.teaching-assistant-completion", async (context) => {
  const contract = await semanticContract(
    context.task.name,
    "subscription_completion",
  );
  const specification = homeworkExpectation(
    "homework.teaching-assistant-completion",
    "subscription_completion",
  );
  const completion = { completedAt: referenceDate };
  const original = { id: "homework-1", sectionId: 1, completion };
  const snapshot = structuredClone(original);
  const [actual] = attachHomeworkCompletionRequired(
    [original],
    new Map([[1, specification.subscription_kind]]),
  );
  contract.equal("/subscription_kind", "teaching_assistant");
  contract.equal("/completion_required", actual.completionRequired);
  contract.equal(
    "/preserve_records",
    isDeepStrictEqual(actual.completion, snapshot.completion),
  );
  expect(actual.completion).toEqual(
    specification.preserve_records ? snapshot.completion : null,
  );
  expect(original).toEqual(snapshot);
  contract.recordVitest(context);
});

it("homework.teaching-assistant-pending", async (context) => {
  const contract = await semanticContract(
    context.task.name,
    "pending_deadline",
  );
  contract.equal("/subscription_kind", "teaching_assistant");
  const specification = homeworkExpectation(
    "homework.teaching-assistant-pending",
    "pending_deadline",
  );
  const completionRequired = completionRequiredForSubscriptionKind(
    specification.subscription_kind,
  );
  const cases = [
    { dueAt: null, field: "without_deadline" },
    {
      dueAt: new Date(referenceDate.getTime() + 1),
      field: "before_deadline",
    },
    { dueAt: referenceDate, field: "at_deadline" },
    {
      dueAt: new Date(referenceDate.getTime() - 1),
      field: "after_deadline",
    },
  ];
  for (const { dueAt, field } of cases) {
    const homework = { completionRequired, submissionDueAt: dueAt };
    contract.equal(
      `/${field}`,
      isHomeworkPendingForViewer(homework, referenceDate),
    );
    contract.equal(
      "/completed",
      isHomeworkPendingForViewer(
        { ...homework, completion: { completedAt: referenceDate } },
        referenceDate,
      ),
    );
  }
  contract.recordVitest(context);
});
