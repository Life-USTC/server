import type {
  ExamView,
  HomeworkView,
  TodoView,
  WorkspaceViewState,
} from "./workspace-controller-helpers";
import { workspaceCardViewChange } from "./workspace-controller-view-actions";

export function createWorkspaceCardViewActions(input: {
  applyWorkspaceViewState: (state: WorkspaceViewState) => void;
  replaceState: (href: string) => void;
}) {
  function setCardView(
    preference: "examView" | "homeworkView" | "todoView",
    mode: ExamView | HomeworkView | TodoView,
  ) {
    const next = workspaceCardViewChange(preference, mode);
    input.applyWorkspaceViewState(next.state);
    input.replaceState(next.href);
  }

  return {
    setExamView(mode: ExamView) {
      setCardView("examView", mode);
    },
    setHomeworkView(mode: HomeworkView) {
      setCardView("homeworkView", mode);
    },
    setTodoView(mode: TodoView) {
      setCardView("todoView", mode);
    },
  };
}
