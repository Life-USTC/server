import type { WorkspaceTimelineItem } from "@/features/workspace/lib/workspace-agenda";
import type {
  SignedWorkspaceData,
  WorkspaceCalendarPreviewData,
  WorkspaceCopy,
  WorkspaceSectionCopy,
  WorkspaceTodoItem,
} from "@/features/workspace/lib/workspace-controller-helpers";
import type { CalendarGridDay } from "$lib/components/calendar/types";
import type { WorkspaceCalendarEvents } from "./workspace-calendar-component-types";

export type OverviewTimelineItem = WorkspaceTimelineItem;

export type OverviewCalendarTimelineItemsForDay = (
  events: WorkspaceCalendarEvents,
) => OverviewTimelineItem[];

export type OverviewWeekDay = CalendarGridDay;

export type OverviewSignedData = SignedWorkspaceData & {
  overviewWeek?: string | null;
  referenceNow?: Date | string | null;
  overview?:
    | (NonNullable<SignedWorkspaceData["overview"]> & {
        calendar?:
          | (WorkspaceCalendarPreviewData & {
              referenceDate?: string | null;
            })
          | null;
      })
    | null;
};

export type OverviewDateFormatter = (
  value: Date | string | null | undefined,
  sectionCopy: WorkspaceSectionCopy,
  signedData: OverviewSignedData,
  locale: string,
) => string;

export type OverviewTodoStatus = (
  todo: WorkspaceTodoItem,
  workspaceCopy: WorkspaceCopy,
) => string;
