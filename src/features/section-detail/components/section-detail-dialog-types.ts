import type { CommentTargetOption } from "@/features/comments/lib/comment-ui";
import type { RoomMapCopy } from "@/features/rooms/lib/room-map-types";
import type { SectionSubscriptionCopy } from "@/features/section-detail/server/section-detail-page-copy";
import type {
  SectionBasicInfoCopy,
  SectionCommonInfoCopy,
  SectionPrimaryName,
  SectionTeacherCopy,
  SectionTeacherName,
} from "./section-basic-info-types";

import type {
  SectionCalendarCopy,
  SectionCalendarEvent,
} from "./section-calendar-tab-types";

import type {
  SectionHomeworkCommonCopy,
  SectionHomeworkDateValue,
} from "./section-homework-display-types";
import type {
  SectionHomework,
  SectionHomeworkCopy as SectionHomeworkTabCopy,
  SectionCopy as SectionHomeworkTabSectionCopy,
} from "./section-homework-tab-types";

export type SectionDetailCommonCopy = SectionHomeworkCommonCopy & {
  home: string;
  sections: string;
  signIn?: string;
} & SectionCommonInfoCopy;

export type SectionDetailDateFormatter = (
  value: SectionHomeworkDateValue,
) => string;

export type SectionDetailMainSectionCopy = SectionCalendarCopy &
  SectionHomeworkTabSectionCopy &
  SectionTeacherCopy &
  SectionBasicInfoCopy & {
    subscriptions: SectionSubscriptionCopy;
    subscribeSuccess: string;
    scheduleDateTime: string;
    addToCalendar: string;
    calendarDescription: string;
    calendarMiniDescription: string;
    classLegend: string;
    date: string;
    examEmpty: string;
    examBatch: string;
    examCount: string;
    examDate: string;
    examLegend: string;
    examTime: string;
    exams: string;
    homeworkDescription: string;
    historicalSectionDescription: string;
    historicalSectionLabel: string;
    lecture: string;
    lectureNumber: string;
    teacher: string;
    location: string;
    tabs: {
      calendar: string;
      comments: string;
      exams: string;
      homeworks: string;
    };
    subscribeLabel: string;
    teachingSection: string;
    time: string;
    unsubscribeLabel: string;
    unsubscribing: string;
    week: string;
    operationFailed: string;
    pleaseRetry: string;
  };

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
