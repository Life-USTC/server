import type { CommentTargetOption } from "@/features/comments/lib/comment-ui";
import type { CalendarGridWeek } from "$lib/components/calendar/types";
import type {
  SectionBasicInfo,
  SectionBasicInfoCopy,
  SectionCommonInfoCopy,
  SectionPrimaryName,
  SectionTeacherCopy,
  SectionTeacherName,
  SectionTeachersLabel,
} from "./section-basic-info-types";
import type {
  SectionCalendarCopy,
  SectionCalendarEvent,
} from "./section-calendar-tab-types";
import type {
  SectionCreateHomeworkCommentsCopy,
  SectionCreateHomeworkCopy,
  SectionCreateHomeworkSectionCopy,
} from "./section-create-homework-types";
import type {
  BooleanSetter,
  FormatMessage,
} from "./section-detail-component-types";
import type {
  SectionHomeworkAuditLog,
  SectionHomeworkAuditLookup,
  SectionHomeworkCommonCopy,
  SectionHomeworkCopy,
  SectionHomeworkDateValue,
  SectionHomeworkFormatter,
  SectionHomeworkMarkdownCopy,
  SectionHomeworkSemesterDate,
  SectionHomeworkSubmitHandler,
  SectionHomeworkTimestampAction,
} from "./section-homework-display-types";
import type {
  HomeworkView,
  SectionHomework,
  SectionHomeworkCopy as SectionHomeworkTabCopy,
  SectionCopy as SectionHomeworkTabSectionCopy,
} from "./section-homework-tab-types";

export type SectionDetailCommonCopy = SectionHomeworkCommonCopy & {
  home: string;
  sections: string;
  signIn?: string;
} & SectionCommonInfoCopy;

export type SectionDetailHomeworkCopy = SectionCreateHomeworkCopy &
  SectionHomeworkCopy;

export type SectionDetailCommentsCopy = SectionCreateHomeworkCommentsCopy &
  SectionHomeworkMarkdownCopy;

export type SectionDetailSectionCopy = SectionCreateHomeworkSectionCopy & {
  calendarSheetDescription: string;
  calendarSheetTitle: string;
  calendarUrlLabel: string;
  copied: string;
  copyToClipboard: string;
  due: string;
  homeworkDescription: string;
  loginRequired: string;
  subscribeLabel: string;
  subscribing: string;
  subscriptionDisclaimer: string;
  subscriptionMissing: string;
  subscriptionUrlLabel: string;
  unsubscribeLabel: string;
  unsubscribing: string;
  viewAllSubscriptions: string;
};

export type SectionDetailClipboardTarget = "single" | "subscription" | null;

export type SectionDetailCopyText = (
  value: string,
  target: Exclude<SectionDetailClipboardTarget, null>,
) => void | Promise<void>;

export type SectionDetailSubscriptionAction = (
  action: "subscribe" | "unsubscribe",
) => import("@sveltejs/kit").SubmitFunction;

export type SectionDetailSubscriptionPendingAction =
  | "subscribe"
  | "unsubscribe"
  | null;

export type SectionDetailHomeworkDialogsProps = {
  applyCreateDueAtSemesterEnd: SectionHomeworkTimestampAction;
  applyCreateDueInMonth: SectionHomeworkTimestampAction;
  applyCreateDueInWeek: SectionHomeworkTimestampAction;
  applyCreatePublishNow: SectionHomeworkTimestampAction;
  applyCreateStartAtSemesterStart: SectionHomeworkTimestampAction;
  applyCreateStartNow: SectionHomeworkTimestampAction;
  applyEditDueAtSemesterEnd: SectionHomeworkTimestampAction;
  applyEditDueInMonth: SectionHomeworkTimestampAction;
  applyEditDueInWeek: SectionHomeworkTimestampAction;
  applyEditPublishNow: SectionHomeworkTimestampAction;
  applyEditStartAtSemesterStart: SectionHomeworkTimestampAction;
  applyEditStartNow: SectionHomeworkTimestampAction;
  auditLogsForHomework: SectionHomeworkAuditLookup;
  canManageSelectedHomework: boolean;
  canWriteHomework: boolean;
  cancelEditHomework: () => void;
  closeCreateHomeworkDialog: () => void;
  commentsCopy: SectionDetailCommentsCopy;
  commonCopy: SectionDetailCommonCopy;
  createHomework: SectionHomeworkSubmitHandler;
  createHomeworkPublishedAt: string;
  createHomeworkSubmissionDueAt: string;
  createHomeworkSubmissionStartAt: string;
  deleteHomework: () => void | Promise<void>;
  deleteHomeworkTarget: SectionHomework | null;
  editHomeworkMessage: string;
  editHomeworkPublishedAt: string;
  editHomeworkSubmissionDueAt: string;
  editHomeworkSubmissionStartAt: string;
  editingHomework: boolean;
  fmtDateTime: SectionHomeworkFormatter;
  formatMessage: FormatMessage;
  hasSemesterEnd: boolean;
  hasSemesterStart: boolean;
  homeworkAuditActionLabel: (action: string) => string;
  homeworkAuditActorName: (log: SectionHomeworkAuditLog) => string;
  homeworkAuditLogs: SectionHomeworkAuditLog[];
  homeworkCopy: SectionDetailHomeworkCopy;
  homeworkDescriptionMaxLength: number;
  homeworkMessage: string;
  homeworkStatus: (homework: SectionHomework) => string;
  homeworkTitleMaxLength: number;
  isHomeworkAuditDialogOpen: boolean;
  sectionCopy: SectionDetailSectionCopy;
  selectedHomework: SectionHomework | null;
  semesterDate: SectionHomeworkSemesterDate;
  setDeleteHomeworkTarget: (homework: SectionHomework | null) => void;
  setHomeworkAuditDialogOpen: BooleanSetter;
  setSelectedHomework: (homework: SectionHomework | null) => void;
  showCreateHomework: boolean;
  startEditHomework: () => void;
  toggleHomeworkCompletion: (homework: SectionHomework) => void | Promise<void>;
  updateHomework: SectionHomeworkSubmitHandler;
};

export type SectionDetailDialogsProps = SectionDetailHomeworkDialogsProps & {
  clipboardError: string;
  clipboardMessage: string;
  closeCalendarDialog: () => void;
  closeSubscribeDialog: () => void;
  copiedCalendarTarget: SectionDetailClipboardTarget;
  copyText: SectionDetailCopyText;
  isCalendarDialogOpen: boolean;
  setCalendarDialogOpen: BooleanSetter;
  showSubscribeDialog: boolean;
  singleCalendarUrl: string;
  subscriptionAction: SectionDetailSubscriptionAction;
  subscriptionCalendarUrl: string;
  subscriptionPendingAction: SectionDetailSubscriptionPendingAction;
};

export type SectionDetailDateFormatter = (
  value: SectionHomeworkDateValue,
) => string;

export type SectionDetailActiveTab = "calendar" | "comments" | "homework";

export type SectionDetailTab = readonly [SectionDetailActiveTab, string];

export type SectionDetailMainSectionCopy = SectionCalendarCopy &
  SectionHomeworkTabSectionCopy &
  SectionTeacherCopy &
  SectionBasicInfoCopy & {
    calendarMiniDescription: string;
    classLegend: string;
    examLegend: string;
    teachingSection: string;
  };

export type SectionDetailMainContentProps = {
  activeTab: SectionDetailActiveTab;
  calendarExamDateKeys: Set<string>;
  calendarMonthDays: Date[];
  calendarMonthLabel: string;
  calendarMonthOffset: number;
  calendarScheduleDateKeys: Set<string>;
  canWriteHomework: boolean;
  commentTargets: CommentTargetOption[];
  commonCopy: SectionCommonInfoCopy;
  dateKey: (value: string | Date | null | undefined) => string | null;
  fmtDate: SectionDetailDateFormatter;
  fmtDateTime: SectionDetailDateFormatter;
  homeworkCopy: SectionHomeworkTabCopy;
  homeworkStatus: (homework: SectionHomework) => string;
  homeworkView: HomeworkView;
  homeworks: SectionHomework[];
  notAvailable: string;
  openCalendarDialog: () => void;
  openCreateHomeworkDialog: () => void;
  periodDetailRows: Array<[string, number]>;
  primaryName: SectionPrimaryName;
  section: SectionBasicInfo & {
    teachers?: Parameters<SectionTeacherName>[0][];
  };
  sectionCalendarEvents: SectionCalendarEvent[];
  sectionCalendarGridWeeks: () => CalendarGridWeek[];
  sectionCopy: SectionDetailMainSectionCopy;
  sectionTeachersLabel: SectionTeachersLabel;
  setActiveTab: (tab: SectionDetailActiveTab) => void;
  setHomeworkView: (view: HomeworkView) => void;
  setSelectedHomework: (homework: SectionHomework) => void;
  tabs: readonly SectionDetailTab[];
  teacherName: SectionTeacherName;
  todayCalendarKey: string | null;
  unscheduledCalendarEvents: SectionCalendarEvent[];
  viewer: { isAuthenticated?: boolean; signedIn?: boolean };
  visibleCalendarMonth: Date;
  yesNo: (value: boolean | null | undefined) => string;
};

export type SectionDetailPageContentProps = SectionDetailDialogsProps &
  SectionDetailMainContentProps & {
    courseName: string;
    courseSecondaryName: string;
    form: { error?: string } | null | undefined;
    openSubscribeDialog: () => void;
    viewer: SectionDetailMainContentProps["viewer"] & {
      isSubscribed?: boolean;
    };
  };
