import type { Component } from "svelte";
import type { DashboardHomeworkItem } from "@/features/dashboard/lib/dashboard-controller-types";

export type DashboardHomeworkDetailItem = DashboardHomeworkItem & {
  description?: string | null;
  id: string;
  isMajor?: boolean | null;
  publishedAt?: Date | string | null;
  requiresTeam?: boolean | null;
  submissionDueAt?: Date | string | null;
  submissionStartAt?: Date | string | null;
};

export type DashboardHomeworkDetailCopy = Record<string, string> & {
  commentsLabel: string;
  commentsTitle: string;
  descriptionEmpty: string;
  homeworkPublishedAt: string;
  saving: string;
  submissionDue: string;
  submissionStart: string;
  tagMajor: string;
  tagTeam: string;
  viewDetails: string;
};

export type DashboardHomeworkDetailFormatter = (
  value: Date | string | null | undefined,
) => string;

export type DashboardHomeworkDetailAction = (
  homework: DashboardHomeworkDetailItem,
) => string;

export type DashboardHomeworkCompletionToggle = (
  homework: DashboardHomeworkDetailItem,
) => void | Promise<void>;

export type DashboardHomeworkCommentsPanel = Component<{
  targetId: string;
  targetType: "homework";
}>;
