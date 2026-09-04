export type {
  HomeworkWithSection,
  SectionWithRelations,
  SubscriptionSchedule,
} from "@/features/subscriptions/server/subscription-dashboard-types";

export type SessionItem = {
  id: string;
  sectionJwId: number | null;
  courseName: string;
  date: Date;
  startTime: number;
  endTime: number;
  location: string;
  /** Teacher names for display (e.g. on overview); may be "—" when none. */
  teacherDisplay: string;
};

export type ExamItem = {
  id: string;
  courseName: string;
  date: Date | null;
  startTime: number | null;
  endTime: number | null;
  examType: number | null;
  examMode: string | null;
  examTakeCount: number | null;
  rooms: Array<{ room: string; count: number }>;
};

export type TimeSlot = {
  key: string;
  startTime: number;
  endTime: number;
};

export type FocusCardItem = {
  key: string;
  icon: unknown;
  title: string;
  name: string;
  meta: string;
  sub: string;
};

export type Translate = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

export type SemesterSummary = {
  id: number;
  nameCn: string | null;
  startDate: Date | null;
  endDate: Date | null;
};
