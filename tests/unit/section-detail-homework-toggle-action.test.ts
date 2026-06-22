import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SectionHomework } from "@/features/section-detail/lib/section-detail-controller-helpers";
import type { SectionDetailHomeworkActionInput } from "@/features/section-detail/lib/section-detail-homework-action-types";

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

function homeworkCopy(): ReturnType<
  SectionDetailHomeworkActionInput["getHomeworkCopy"]
> {
  return new Proxy<Record<string, string>>(
    { completionFailed: "completion failed" },
    {
      get: (target, property) =>
        typeof property === "string" ? (target[property] ?? property) : "",
    },
  ) as unknown as ReturnType<
    SectionDetailHomeworkActionInput["getHomeworkCopy"]
  >;
}

function actionInput(
  overrides: Partial<SectionDetailHomeworkActionInput>,
): SectionDetailHomeworkActionInput {
  return {
    cancelEditHomework: vi.fn(),
    closeCreateHomeworkDialog: vi.fn(),
    getCreateHomeworkPublishedAt: () => "",
    getCreateHomeworkSubmissionDueAt: () => "",
    getCreateHomeworkSubmissionStartAt: () => "",
    getDeleteHomeworkTarget: () => null,
    getEditHomeworkPublishedAt: () => "",
    getEditHomeworkSubmissionDueAt: () => "",
    getEditHomeworkSubmissionStartAt: () => "",
    getHomeworkCopy: homeworkCopy,
    getHomeworkViewer: () => ({
      isAdmin: false,
      isAuthenticated: true,
      isSuspended: false,
    }),
    getHomeworks: () => [],
    getSectionId: () => 1,
    getSelectedHomework: () => null,
    setDeleteHomeworkTarget: vi.fn(),
    setEditHomeworkMessage: vi.fn(),
    setHomeworkAuditLogs: vi.fn(),
    setHomeworkMessage: vi.fn(),
    setHomeworkViewer: vi.fn(),
    setHomeworks: vi.fn(),
    setSelectedHomework: vi.fn(),
    ...overrides,
  };
}

describe("section detail homework toggle action", () => {
  beforeEach(() => {
    updateHomeworkCompletionMock.mockReset();
  });

  it("updates homework completion through the shared client", async () => {
    const homework = {
      id: "homework-1",
      completion: null,
      title: "Homework",
    } as SectionHomework;
    const homeworks = [homework];
    const setHomeworks = vi.fn();
    const setSelectedHomework = vi.fn();
    const setHomeworkMessage = vi.fn();
    updateHomeworkCompletionMock.mockResolvedValue({
      completed: true,
      completedAt: "2026-06-22T10:00:00.000Z",
    });

    const { createSectionHomeworkToggleAction } = await import(
      "@/features/section-detail/lib/section-detail-homework-toggle-action"
    );

    const { toggleHomeworkCompletion } = createSectionHomeworkToggleAction(
      actionInput({
        getHomeworks: () => homeworks,
        getSelectedHomework: () => homework,
        setHomeworkMessage,
        setHomeworks,
        setSelectedHomework,
      }),
    );

    await toggleHomeworkCompletion(homework);

    expect(updateHomeworkCompletionMock).toHaveBeenCalledWith({
      completed: true,
      fallbackMessage: "completion failed",
      homeworkId: "homework-1",
    });
    expect(setHomeworkMessage).toHaveBeenCalledWith("");
    expect(setHomeworks).toHaveBeenCalledWith([
      expect.objectContaining({
        completion: { completedAt: "2026-06-22T10:00:00.000Z" },
      }),
    ]);
    expect(setSelectedHomework).toHaveBeenCalledWith(
      expect.objectContaining({
        completion: { completedAt: "2026-06-22T10:00:00.000Z" },
      }),
    );
  });

  it("surfaces localized completion failures instead of raw API messages", async () => {
    const homework = {
      id: "homework-1",
      completion: { completedAt: "2026-06-22T10:00:00.000Z" },
      title: "Homework",
    } as SectionHomework;
    const setHomeworks = vi.fn();
    const setSelectedHomework = vi.fn();
    const setHomeworkMessage = vi.fn();
    updateHomeworkCompletionMock.mockRejectedValue(
      new Error("homework not found"),
    );

    const { createSectionHomeworkToggleAction } = await import(
      "@/features/section-detail/lib/section-detail-homework-toggle-action"
    );

    const { toggleHomeworkCompletion } = createSectionHomeworkToggleAction({
      ...actionInput({
        getHomeworks: () => [homework],
        getSelectedHomework: () => homework,
        setHomeworkMessage,
        setHomeworks,
        setSelectedHomework,
      }),
    });

    await toggleHomeworkCompletion(homework);

    expect(updateHomeworkCompletionMock).toHaveBeenCalledWith({
      completed: false,
      fallbackMessage: "completion failed",
      homeworkId: "homework-1",
    });
    expect(setHomeworkMessage).toHaveBeenLastCalledWith("completion failed");
    expect(setHomeworks).not.toHaveBeenCalled();
    expect(setSelectedHomework).not.toHaveBeenCalled();
  });
});
