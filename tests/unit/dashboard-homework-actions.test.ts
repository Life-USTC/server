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

  it("surfaces localized dashboard completion failures", async () => {
    const homework = {
      id: "homework-1",
      completion: null,
      submissionDueAt: null,
      title: "Homework",
    } as HomeworkItem;
    let homeworkSavingById: Record<string, boolean> = {};
    const setHomeworkActionError = vi.fn();
    const setHomeworkItems = vi.fn();
    const setSelectedHomework = vi.fn();
    updateHomeworkCompletionMock.mockRejectedValue(
      new Error("homework not found"),
    );

    const { createDashboardHomeworkStateActions } = await import(
      "@/features/dashboard/lib/dashboard-controller-homework-state-actions"
    );

    const { toggleHomeworkCompletion } = createDashboardHomeworkStateActions({
      getHomeworkItems: () => [homework],
      getHomeworkSavingById: () => homeworkSavingById,
      getHomeworksCopy: () => ({ completionFailed: "completion failed" }),
      getSelectedHomework: () => homework,
      setHomeworkActionError,
      setHomeworkItems,
      setHomeworkSavingById: (value) => {
        homeworkSavingById = value;
      },
      setSelectedHomework,
    });

    await toggleHomeworkCompletion(homework);

    expect(updateHomeworkCompletionMock).toHaveBeenCalledWith({
      completed: true,
      fallbackMessage: "completion failed",
      homeworkId: "homework-1",
    });
    expect(setHomeworkActionError).toHaveBeenNthCalledWith(1, "");
    expect(setHomeworkActionError).toHaveBeenLastCalledWith(
      "completion failed",
    );
    expect(homeworkSavingById).toEqual({ "homework-1": false });
    expect(setHomeworkItems).not.toHaveBeenCalled();
    expect(setSelectedHomework).not.toHaveBeenCalled();
  });
});
