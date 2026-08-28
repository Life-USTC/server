import { toShanghaiDateTimeLocalValue } from "@/lib/time/shanghai-format";
import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardTodoItem,
  DashboardTodosCopy,
} from "./dashboard-controller-types";
import {
  formatDashboardDateTime,
  formatDashboardDueRelativeTime,
  isDashboardDueOverdue,
} from "./date-formatters";
import {
  todoActionLabel as buildTodoActionLabel,
  todoStatus as buildTodoStatus,
} from "./todos";

export function createTodoTabDisplayActions({
  dashboardCopy,
  locale,
  referenceDate,
  sectionCopy,
  todosCopy,
}: {
  dashboardCopy: DashboardDashboardCopy;
  locale: string;
  referenceDate: Date | string;
  sectionCopy: DashboardSectionCopy;
  todosCopy: DashboardTodosCopy;
}) {
  return {
    datetimeLocalValue: (value: Date | string | null | undefined) =>
      toShanghaiDateTimeLocalValue(value),
    fmtDate: (value: Date | string | null | undefined) =>
      formatDashboardDateTime(
        value,
        sectionCopy.dateTBD,
        referenceDate,
        locale,
      ),
    todoActionLabel: (todo: DashboardTodoItem) =>
      buildTodoActionLabel(todo, {
        markIncomplete: String(todosCopy.markIncomplete),
        markComplete: String(todosCopy.markComplete),
      }),
    todoStatus: (todo: DashboardTodoItem) =>
      buildTodoStatus(todo, {
        completed: dashboardCopy.completedStatus,
        pending: dashboardCopy.pendingStatus,
      }),
    relativeDueLabel: (value: Date | string | null | undefined) =>
      formatDashboardDueRelativeTime(
        value,
        sectionCopy.dateTBD,
        referenceDate,
        locale,
      ),
    isDueOverdue: (value: Date | string | null | undefined) =>
      isDashboardDueOverdue(value, referenceDate),
  };
}
