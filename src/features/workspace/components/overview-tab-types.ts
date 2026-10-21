import type { WorkspaceTimelineItem } from "@/features/workspace/lib/workspace-agenda";
import type {
  SignedWorkspaceData,
  WorkspaceCalendarPreviewData,
} from "@/features/workspace/lib/workspace-controller-helpers";
import type { WorkspaceCalendarEvents } from "./workspace-calendar-component-types";

export type OverviewTimelineItem = WorkspaceTimelineItem;

export type OverviewCalendarTimelineItemsForDay = (
  events: WorkspaceCalendarEvents,
) => OverviewTimelineItem[];

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
