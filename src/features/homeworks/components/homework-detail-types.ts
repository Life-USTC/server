import type { Component, Snippet } from "svelte";
import type {
  HomeworkDateValue,
  HomeworkDeadlineState,
  HomeworkDetailModel,
} from "@/features/homeworks/lib/homework-presentation";

export type HomeworkDetailCopy = {
  completedLabel: string;
  commentsTitle: string;
  descriptionLabel: string;
  descriptionEmpty: string;
  markComplete: string;
  markIncomplete: string;
  moreDetails: string;
  pendingLabel: string;
  publishedAt: string;
  relativeTime: string;
  saving: string;
  statusLabel: string;
  submissionDue: string;
  submissionStart: string;
  tagMajor: string;
  tagTeam: string;
};

export type HomeworkDetailCommentsPanel = Component<{
  heading?: string | null;
  permalinkBaseHref?: string | null;
  targetId: string;
  targetType: "homework";
}>;

export type HomeworkDetailDateFormatter = (value: HomeworkDateValue) => string;

export type HomeworkDetailRelativeFormatter = (
  value: HomeworkDateValue,
  referenceDate: HomeworkDateValue,
) => string;

export type HomeworkDetailToggle = () => void | Promise<void>;

export type HomeworkDetailActionsSnippet = Snippet;

export type HomeworkDetailProps = {
  CommentsPanel: HomeworkDetailCommentsPanel;
  completionSaving?: boolean;
  contextActions?: HomeworkDetailActionsSnippet;
  additionalContent?: HomeworkDetailActionsSnippet;
  contextHref?: string | null;
  contextLabel?: string | null;
  copy: HomeworkDetailCopy;
  dateFallback: string;
  deadlineState?: (value: HomeworkDateValue) => HomeworkDeadlineState;
  editing?: boolean;
  editingContent?: HomeworkDetailActionsSnippet;
  fmtDate: HomeworkDetailDateFormatter;
  homework: HomeworkDetailModel | null;
  onClose: () => void;
  onToggleCompletion?: HomeworkDetailToggle;
  permalinkBaseHref?: string | null;
  relativeEtaLabel: HomeworkDetailRelativeFormatter;
  showContextActions?: boolean;
  showCompletion?: boolean;
  referenceDate?: HomeworkDateValue;
};
