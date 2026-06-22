import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeworkItem } from "@/features/dashboard/lib/dashboard-controller-helpers";

const updateHomeworkCompletionMock = vi.fn();

vi.mock("@/features/homeworks/lib/homework-completion-client", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/homeworks/lib/homework-completion-client")
  >("@/features/homeworks/lib/homework-completion-client");
  return {
    ...actual,
    updateHomeworkCompletion: updateHomeworkCompletionMock,
  };
});

describe("dashboard homework actions", () => {
  beforeEach(() => {
    updateHomeworkCompletionMock.mockReset();
  });

  it("updates homework completion through the shared client", async () => {
    const homework = {
      id: "homework-1",
      completion: null,
      submissionDueAt: null,
      title: "Homework",
    } as HomeworkItem;
    updateHomeworkCompletionMock.mockResolvedValue({
      completed: true,
      completedAt: "2026-06-22T10:00:00.000Z",
    });

    const { toggleDashboardHomeworkCompletion } = await import(
      "@/features/dashboard/lib/dashboard-controller-homework-actions"
    );

    await expect(
      toggleDashboardHomeworkCompletion({
        errorMessage: "completion failed",
        homework,
      }),
    ).resolves.toEqual({
      ...homework,
      completion: { completedAt: "2026-06-22T10:00:00.000Z" },
    });

    expect(updateHomeworkCompletionMock).toHaveBeenCalledWith({
      completed: true,
      fallbackMessage: "completion failed",
      homeworkId: "homework-1",
    });
  });
});
