import {
  formatWorkspaceDateTime,
  formatWorkspaceDueRelativeTime,
} from "@/features/workspace/lib/date-formatters";
import { referenceDate } from "@/features/workspace/lib/overview";
import { todoStatus as buildTodoStatus } from "@/features/workspace/lib/todos";
import type {
  WorkspaceCopy,
  WorkspaceSectionCopy,
  WorkspaceTodoItem,
} from "@/features/workspace/lib/workspace-controller-helpers";
import type { OverviewSignedData } from "./overview-tab-types";

export function formatOverviewDate(
  value: Date | string | null | undefined,
  sectionCopy: WorkspaceSectionCopy,
  signedData: OverviewSignedData,
  locale: string,
) {
  return formatWorkspaceDateTime(
    value,
    sectionCopy.dateTBD,
    referenceDate(signedData.referenceNow),
    locale,
  );
}

export function formatOverviewHomeworkEta(
  value: Date | string | null | undefined,
  sectionCopy: WorkspaceSectionCopy,
  signedData: OverviewSignedData,
  locale: string,
) {
  return formatWorkspaceDueRelativeTime(
    value,
    sectionCopy.dateTBD,
    referenceDate(signedData.referenceNow),
    locale,
  );
}

export function overviewTodoStatus(
  todo: WorkspaceTodoItem,
  workspaceCopy: WorkspaceCopy,
) {
  return buildTodoStatus(todo, {
    completed: workspaceCopy.completedStatus,
    pending: workspaceCopy.pendingStatus,
  });
}
