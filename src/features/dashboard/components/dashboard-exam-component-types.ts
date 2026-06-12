import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
} from "@/features/dashboard/lib/dashboard-controller-types";
import type { dashboardTabHref } from "@/features/dashboard/lib/dashboard-nav";
import type { DashboardNamed } from "./dashboard-component-types";

export type DashboardExamFilter = "incomplete" | "completed" | "all";

export type DashboardExamRow = {
  completed: boolean;
  courseName: string;
  dateKey?: string | null;
  endTime?: Date | string | null;
  examMode?: string | null;
  rooms?: string | null;
  section: {
    code?: string | null;
    jwId?: string | null;
    semester?: unknown | null;
  };
  startTime?: Date | string | null;
};

export type DashboardTabHref = typeof dashboardTabHref;

export type ExamTimeLabel = (
  startTime: Date | string | null | undefined,
  endTime: Date | string | null | undefined,
) => string;

export type ExamMetadataLabels = (exam: DashboardExamRow) => string[];

export type NamePrimary = (value?: DashboardNamed | null) => string;

export type ExamsCopyProps = {
  dashboardCopy: DashboardDashboardCopy;
  sectionCopy: DashboardSectionCopy;
  subscriptionsCopy: DashboardSubscriptionsCopy;
};
