import { workspaceDeadlineLabels } from "./date-formatters";
import {
  todoActionLabel as buildTodoActionLabel,
  todoStatus as buildTodoStatus,
} from "./todos";
import type {
  WorkspaceCopy,
  WorkspaceSectionCopy,
  WorkspaceTodoItem,
  WorkspaceTodosCopy,
} from "./workspace-controller-types";

export function createTodoTabDisplayActions({
  workspaceCopy,
  locale,
  referenceDate,
  sectionCopy,
  todosCopy,
}: {
  workspaceCopy: WorkspaceCopy;
  locale: string;
  referenceDate: Date | string;
  sectionCopy: WorkspaceSectionCopy;
  todosCopy: WorkspaceTodosCopy;
}) {
  return {
    ...workspaceDeadlineLabels(referenceDate, locale, sectionCopy.dateTBD),
    todoActionLabel: (todo: WorkspaceTodoItem) =>
      buildTodoActionLabel(todo, {
        markIncomplete: String(todosCopy.markIncomplete),
        markComplete: String(todosCopy.markComplete),
      }),
    todoStatus: (todo: WorkspaceTodoItem) =>
      buildTodoStatus(todo, {
        completed: workspaceCopy.completedStatus,
        pending: workspaceCopy.pendingStatus,
      }),
  };
}
