import { createHomeworkDashboardAction } from "@/features/workspace/server/dashboard-homework-page-actions";
import {
  createTodoDashboardAction,
  updateTodoDashboardAction,
} from "@/features/workspace/server/dashboard-todo-page-actions";

export const dashboardPageActions = {
  createHomework: createHomeworkDashboardAction,
  createTodo: createTodoDashboardAction,
  updateTodo: updateTodoDashboardAction,
};
