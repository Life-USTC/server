import { createHomeworkDashboardAction } from "@/features/dashboard/server/dashboard-homework-page-actions";
import {
  createTodoDashboardAction,
  deleteTodoDashboardAction,
  toggleTodoDashboardAction,
  updateTodoDashboardAction,
} from "@/features/dashboard/server/dashboard-todo-page-actions";

export const dashboardPageActions = {
  createHomework: createHomeworkDashboardAction,
  createTodo: createTodoDashboardAction,
  deleteTodo: deleteTodoDashboardAction,
  toggleTodo: toggleTodoDashboardAction,
  updateTodo: updateTodoDashboardAction,
};
