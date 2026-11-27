import type { OfficialAcademicProfile } from "@/features/catalog/lib/official-academic-profile";
import type { CommentsInitialData } from "@/features/comments/lib/comment-panel-data";
import type { DemoView } from "@/features/demo/lib/demo-types";
import type { DescriptionPayload } from "@/features/descriptions/lib/description-card-actions";
import type { getSectionDetailPageCopy } from "@/features/section-detail/server/section-detail-page-copy";
import type { AppLocale } from "@/i18n/config";

export type SectionDetailNamed = {
  id?: string | number;
  nameCn?: string | null;
  nameEn?: string | null;
  namePrimary?: string | null;
  nameSecondary?: string | null;
};

export type SectionDetailTeacher = SectionDetailNamed & {
  teacherTitle?: SectionDetailNamed | null;
  department?: SectionDetailNamed | null;
  id: string | number;
};

export type SectionDetailSemester = {
  endDate?: string | Date | null;
  nameCn?: string | null;
  startDate?: string | Date | null;
};

export type SectionDetailScheduleRoom = SectionDetailNamed & {
  code?: string | null;
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
  teachers: SectionDetailTeacher[];
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
  teacherAssignments?: Array<{
    role?: string | null;
    teacherLessonType?: SectionDetailNamed | null;
  }>;
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
  examCount: number;
  exams: SectionDetailExam[];
  experimentPeriods?: number | null;
  graduateAndPostgraduate?: boolean | null;
  id: number;
  jwId: string | number;
  limitCount?: number | null;
  machinePeriods?: number | null;
  openDepartment?: SectionDetailNamed | null;
  period?: number | null;
  periodsPerWeek?: number | null;
  practicePeriods?: number | null;
  remark?: string | null;
  scheduleRemark?: string | null;
  retiredAt?: string | Date | null;
  roomType?: SectionDetailNamed | null;
  schedules: SectionDetailSchedule[];
  scheduleCount: number;
  otherCourseSectionCount: number;
  otherCourseSections: SectionDetailRelatedSection[];
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

type PageCopy = ReturnType<typeof getSectionDetailPageCopy>;
export type SectionDetailCopy = Omit<PageCopy, "metadata"> & {
  metadata: { pages: Pick<PageCopy["metadata"]["pages"], "sectionDetail"> };
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
  officialProfile?: OfficialAcademicProfile | null;
  demo?: DemoView | null;
  commentsData: CommentsInitialData | null;
  copy: SectionDetailCopy;
  descriptionData: DescriptionPayload;
  detailSection:
    | "overview"
    | "introduction"
    | "schedule"
    | "calendar"
    | "exams"
    | "homework"
    | "teachers"
    | "comments";
  focusedHomeworkId?: string | null;
  homeworkData: {
    auditLogs: HomeworkAuditLog[];
    homeworks: SectionHomework[];
    viewer: HomeworkViewer;
  };
  homeworkView?: string | null;
  locale: AppLocale;
  section: SectionDetailSection;
  showSubscribeDialog: boolean;
  structuredDataJson: string;
  todayCalendarKey: string;
  viewer: {
    loading?: boolean;
    failed?: boolean;
    isSubscribed?: boolean;
    subscriptionKind?: "regular" | "auditor" | "teaching_assistant";
    signedIn?: boolean;
  };
};

export type SectionDetailActionData =
  | (Record<string, unknown> & { error?: string })
  | null
  | undefined;

export type SectionHomework = {
  completion: { completedAt: string | null } | null;
  completionRequired?: boolean;
  commentCount?: number;
  createdById?: string | null;
  description?: { content?: string | null; renderedHtml?: string } | null;
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
