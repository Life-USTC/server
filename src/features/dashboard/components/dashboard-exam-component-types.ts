import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  ExamRow,
} from "@/features/dashboard/lib/dashboard-controller-types";
import type { dashboardTabHref } from "@/features/dashboard/lib/dashboard-nav";
import type { DashboardNamed } from "./dashboard-component-types";

export type DashboardExamFilter = "incomplete" | "completed" | "all";

export type DashboardExamRow = ExamRow;

export type DashboardTabHref = typeof dashboardTabHref;

export type ExamTimeLabel = (
  startTime: number | null | undefined,
  endTime: number | null | undefined,
) => string;

export type ExamMetadataLabels = (exam: DashboardExamRow) => string[];

export type NamePrimary = (value?: DashboardNamed | null) => string;

export type ExamsCopyProps = {
  dashboardCopy: DashboardDashboardCopy;
  sectionCopy: DashboardSectionCopy;
  subscriptionsCopy: DashboardSubscriptionsCopy;
};
