import type {
  ExamRow,
  WorkspaceCopy,
  WorkspaceSectionCopy,
  WorkspaceSubscriptionsCopy,
} from "@/features/workspace/lib/workspace-controller-types";
import type { workspaceTabHref } from "@/features/workspace/lib/workspace-nav";
import type { WorkspaceNamed } from "./workspace-component-types";

export type WorkspaceExamFilter = "incomplete" | "completed" | "all";

export type WorkspaceExamRow = ExamRow;

export type WorkspaceTabHref = typeof workspaceTabHref;

export type ExamTimeLabel = (
  startTime: number | null | undefined,
  endTime: number | null | undefined,
) => string;

export type ExamMetadataLabels = (exam: WorkspaceExamRow) => string[];

export type NamePrimary = (value?: WorkspaceNamed | null) => string;

export type ExamsCopyProps = {
  workspaceCopy: WorkspaceCopy;
  sectionCopy: WorkspaceSectionCopy;
  subscriptionsCopy: WorkspaceSubscriptionsCopy;
};
