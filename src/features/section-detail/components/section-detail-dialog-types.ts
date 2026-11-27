import type { CommentTargetOption } from "@/features/comments/lib/comment-ui";
import type { RoomMapCopy } from "@/features/rooms/lib/room-map-types";
import type { SectionDetailCopy } from "@/features/section-detail/lib/section-detail-controller-types";
import type {
  SectionPrimaryName,
  SectionTeacherName,
} from "./section-basic-info-types";
import type { SectionCalendarEvent } from "./section-calendar-tab-types";
import type { SectionHomeworkDateValue } from "./section-homework-display-types";
import type {
  SectionHomework,
  SectionHomeworkCopy as SectionHomeworkTabCopy,
} from "./section-homework-tab-types";

export type SectionDetailCommonCopy = SectionDetailCopy["common"];
export type SectionDetailDateFormatter = (
  value: SectionHomeworkDateValue,
) => string;
export type SectionDetailMainSectionCopy = SectionDetailCopy["sectionDetail"];

export type SectionDetailMainContentProps = {
  canWriteHomework: boolean;
  commentTargets: CommentTargetOption[];
  commonCopy: SectionDetailCommonCopy;
  fmtDate: SectionDetailDateFormatter;
  fmtDateTime: SectionDetailDateFormatter;
  homeworkCopy: SectionHomeworkTabCopy;
  homeworks: SectionHomework[];
  notAvailable: string;
  openCalendarDialog: () => void;
  openCreateHomeworkDialog: () => void;
  periodDetailRows: Array<[string, number]>;
  primaryName: SectionPrimaryName;
  roomMapCopy: RoomMapCopy;
  sectionCalendarEvents: SectionCalendarEvent[];
  sectionCopy: SectionDetailMainSectionCopy;
  setSelectedHomework: (homework: SectionHomework) => void | Promise<void>;
  retryStreamPanels: () => void;
  streamError: string | null;
  streamLoading: boolean;
  teacherName: SectionTeacherName;
  viewer: {
    isAuthenticated?: boolean;
    signedIn?: boolean;
    isSubscribed?: boolean;
    subscriptionKind?: "regular" | "auditor" | "teaching_assistant";
    loading?: boolean;
    failed?: boolean;
  };
  yesNo: (value: boolean | null | undefined) => string;
};
