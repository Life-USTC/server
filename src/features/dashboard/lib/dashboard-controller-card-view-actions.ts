import type {
  DashboardViewState,
  ExamView,
  HomeworkView,
  TodoView,
} from "./dashboard-controller-helpers";
import { dashboardCardViewChange } from "./dashboard-controller-view-actions";

export function createDashboardCardViewActions(input: {
  applyDashboardViewState: (state: DashboardViewState) => void;
  replaceState: (href: string) => void;
}) {
  function setCardView(
    preference: "examView" | "homeworkView" | "todoView",
    mode: ExamView | HomeworkView | TodoView,
  ) {
    const next = dashboardCardViewChange(preference, mode);
    input.applyDashboardViewState(next.state);
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
