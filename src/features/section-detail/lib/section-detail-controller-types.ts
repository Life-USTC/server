import type { CommentsInitialData } from "@/features/comments/lib/comment-panel-data";
import type { DescriptionPayload } from "@/features/descriptions/lib/description-card-actions";
import type { AppLocale } from "@/i18n/config";

export type SectionDetailNamed = {
  id?: string | number;
  nameCn?: string | null;
  nameEn?: string | null;
  namePrimary?: string | null;
  nameSecondary?: string | null;
};

export type SectionDetailTeacher = SectionDetailNamed & {
  id: string | number;
};

export type SectionDetailSemester = {
  endDate?: string | Date | null;
  nameCn?: string | null;
  startDate?: string | Date | null;
};

export type SectionDetailScheduleRoom = SectionDetailNamed & {
  building?:
    | (SectionDetailNamed & {
        campus?: SectionDetailNamed | null;
      })
    | null;
};

export type SectionDetailSchedule = {
  customPlace?: string | null;
  date?: string | Date | null;
  endTime?: number | null;
  endUnit?: number | null;
  room?: SectionDetailScheduleRoom | null;
  startTime?: number | null;
  startUnit?: number | null;
  teachers: SectionDetailNamed[];
  weekIndex?: number | null;
};

export type SectionDetailExam = {
  endTime?: number | null;
  examBatch?: SectionDetailNamed | null;
  examDate?: string | Date | null;
  examMode?: string | null;
  examRooms: Array<{
    count?: number | null;
    room?: string | null;
  }>;
  examTakeCount?: number | null;
  id: string | number;
  startTime?: number | null;
};

export type SectionDetailSection = {
  actualPeriods?: number | null;
  adminClasses: SectionDetailNamed[];
  campus?: SectionDetailNamed | null;
  code: string;
  course: SectionDetailNamed & { id: number; jwId: number | string };
  courseId: number;
  credits?: number | null;
  dateTimePlaceText?: string | null;
  designPeriods?: number | null;
  examMode?: SectionDetailNamed | null;
  exams: SectionDetailExam[];
  experimentPeriods?: number | null;
  graduateAndPostgraduate?: boolean | null;
  id: number;
  jwId: string | number;
  limitCount?: number | null;
  machinePeriods?: number | null;
  openDepartment?: SectionDetailNamed | null;
  otherSections?: SectionDetailRelatedSection[];
  period?: number | null;
  periodsPerWeek?: number | null;
  practicePeriods?: number | null;
  remark?: string | null;
  roomType?: SectionDetailNamed | null;
  schedules: SectionDetailSchedule[];
  sameSemesterOtherTeachers: SectionDetailRelatedSection[];
  sameTeacherOtherSemesters: SectionDetailRelatedSection[];
  semester?: SectionDetailSemester | null;
  semesterId?: number | null;
  stdCount?: number | null;
  teachLanguage?: SectionDetailNamed | null;
  teachers: SectionDetailTeacher[];
  testPeriods?: number | null;
  theoryPeriods?: number | null;
  timesPerWeek?: number | null;
};

export type SectionDetailRelatedSection = {
  code: string;
  jwId: number | string;
  semester?: {
    nameCn?: string | null;
  } | null;
  semesterId?: number | null;
  teachers?: SectionDetailTeacher[];
};

export type SectionDetailCopy = {
  comments: Record<string, unknown> & {
    markdownGuide: string;
    previewEmpty: string;
    tabPreview: string;
    tabSectionTeacher: string;
    tabWrite: string;
  };
  common: Record<string, string> & {
    home: string;
    sections: string;
    signIn?: string;
    undergraduateGraduate: string;
    unknown: string;
  };
  descriptions: Record<string, string> & {
    cancel: string;
    edit: string;
    editedBy: string;
    editorPlaceholder: string;
    editorUnknown: string;
    empty: string;
    emptyValue: string;
    historyEmpty: string;
    historyTitle: string;
    lastEdited: string;
    loadFailed: string;
    loginToEdit: string;
    markdownGuide: string;
    previewEmpty: string;
    previousLabel: string;
    save: string;
    saving: string;
    suspendedExpires: string;
    suspendedMessage: string;
    suspendedPermanent: string;
    suspendedReason: string;
    suspendedTitle: string;
    tabPreview: string;
    tabWrite: string;
    title: string;
    updateError: string;
    updatedLabel: string;
  };
  homeworks: Record<string, string> & {
    auditCreated: string;
    auditDeleted: string;
    auditTitle: string;
    auditEmpty: string;
    auditMeta: string;
    cancel: string;
    completedLabel: string;
    contentHistoryAction: string;
    contentHistoryActor: string;
    createAction: string;
    createTitle: string;
    deleteAction: string;
    deleteDescription: string;
    deleteTitle: string;
    descriptionEmpty: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    editAction: string;
    helperClear: string;
    helperMonth: string;
    helperPublishNow: string;
    helperSemesterEnd: string;
    helperSemesterStart: string;
    helperStartNow: string;
    helperWeek: string;
    loginToCreate: string;
    markComplete: string;
    markIncomplete: string;
    publishedAt: string;
    saveChanges: string;
    showCreate: string;
    submissionDue: string;
    submissionStart: string;
    subtitle: string;
    tagDefault: string;
    tagMajor: string;
    tagTeam: string;
    titleLabel: string;
    titlePlaceholder: string;
  };
  sectionDetail: {
    addToCalendar: string;
    adminClasses: string;
    basicInfo: string;
    basicInfoDescription: string;
    campus: string;
    calendarMiniDescription: string;
    calendarEmpty: string;
    calendarSheetDescription: string;
    calendarSheetTitle: string;
    calendarUrlLabel: string;
    cardsView: string;
    classEventTitle: string;
    classEvent: string;
    classLegend: string;
    close?: string;
    copied: string;
    copyToClipboard: string;
    courseComments: string;
    credits: string;
    dateTBD: string;
    department: string;
    designPeriods: string;
    examBatch: string;
    examCount: string;
    examEvent: string;
    examLegend: string;
    examMode: string;
    experimentPeriods: string;
    location: string;
    loginRequired: string;
    listView: string;
    machinePeriods: string;
    no: string;
    noTeacher: string;
    noHomework: string;
    noTeachersListed: string;
    notAvailable: string;
    operationFailed: string;
    otherSections: string;
    period: string;
    periodsPerWeek: string;
    practicePeriods: string;
    remark: string;
    roomTbd: string;
    roomType: string;
    sameSemesterOtherTeachers: string;
    sameTeacherOtherSemesters: string;
    schedulingDetails: string;
    sectionComments: string;
    sectionCode: string;
    semester: string;
    subscribeLabel: string;
    subscribing: string;
    subscriptionDisclaimer: string;
    subscriptionMissing: string;
    subscriptionUrlLabel: string;
    tabs: {
      calendar: string;
      comments: string;
      homeworks: string;
    };
    teachLanguage: string;
    teacher: string;
    teachers: string;
    teachersDescription: string;
    teachingSection: string;
    testPeriods: string;
    theoryPeriods: string;
    title: string;
    units: string;
    unsubscribeLabel: string;
    unsubscribing: string;
    due: string;
    flags: string;
    homeworkDescription: string;
    homeworkView: string;
    previousMonth: string;
    nextMonth: string;
    moreEvents: string;
    moreDetails: string;
    today: string;
    week: string;
    weekLabel: string;
    weekdays: {
      shortFriday: string;
      shortMonday: string;
      shortSaturday: string;
      shortSunday: string;
      shortThursday: string;
      shortTuesday: string;
      shortWednesday: string;
    };
    weekNumber: string;
    viewAllCourseSections: string;
    viewAllSubscriptions: string;
    yes: string;
  };
  metadata: {
    pages: {
      sectionDetail: string;
    };
  };
};

export type HomeworkViewer = {
  isAdmin: boolean;
  isAuthenticated: boolean;
  isSuspended: boolean;
  userId?: string | null;
};

export type HomeworkAuditLog = {
  action: string;
  actor?: {
    id?: string | null;
    name?: string | null;
    username?: string | null;
  } | null;
  createdAt?: string | Date | null;
  homeworkId: string | null;
  id: string | number;
  titleSnapshot?: string | null;
  [key: string]: unknown;
};

export type SectionDetailPageData = {
  commentsData: CommentsInitialData | null;
  copy: SectionDetailCopy;
  descriptionData: DescriptionPayload;
  homeworkData: {
    auditLogs: HomeworkAuditLog[];
    homeworks: SectionHomework[];
    viewer: HomeworkViewer;
  };
  homeworkView?: string | null;
  locale: AppLocale;
  section: SectionDetailSection;
  showSubscribeDialog: boolean;
  tab?: string | null;
  viewer: {
    isSubscribed?: boolean;
    signedIn?: boolean;
    subscriptionIcsUrl?: string | null;
  };
};

export type SectionDetailActionData =
  | (Record<string, unknown> & { error?: string })
  | null
  | undefined;

export type SectionHomework = {
  completion: { completedAt: string | null } | null;
  commentCount?: number;
  createdById?: string | null;
  description?: { content?: string | null } | null;
  id: string;
  isMajor: boolean;
  publishedAt?: string | Date | null;
  requiresTeam: boolean;
  submissionDueAt: string | Date | null;
  submissionStartAt?: string | Date | null;
  title: string;
  [key: string]: unknown;
};
export type ScheduleItem =
  SectionDetailPageData["section"]["schedules"][number];
export type ExamItem = SectionDetailPageData["section"]["exams"][number];

export const HOMEWORK_TITLE_MAX_LENGTH = 200;
export const HOMEWORK_DESCRIPTION_MAX_LENGTH = 4000;
