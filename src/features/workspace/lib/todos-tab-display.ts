import { toShanghaiDateTimeLocalValue } from "@/lib/time/shanghai-format";
import { formatWorkspaceDateTime } from "./date-formatters";
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
    datetimeLocalValue: (value: Date | string | null | undefined) =>
      toShanghaiDateTimeLocalValue(value),
    fmtDate: (value: Date | string | null | undefined) =>
      formatWorkspaceDateTime(
        value,
        sectionCopy.dateTBD,
        referenceDate,
        locale,
      ),
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
