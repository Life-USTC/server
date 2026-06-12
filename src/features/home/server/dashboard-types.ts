export type HomeworkWithSection = {
  id: string;
  title: string;
  publishedAt: Date | null;
  submissionStartAt: Date | null;
  submissionDueAt: Date | null;
  description?: { content: string } | null;
  homeworkCompletions: Array<{ completedAt: Date }>;
  section: {
    jwId: number | null;
    course: { namePrimary: string | null } | null;
  } | null;
};

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

export type SectionWithRelations = {
  id: number;
  jwId: number | null;
  course: { namePrimary: string | null };
  semester: { id: number } | null;
  schedules: Array<{
    id: number;
    date: Date | null;
    startTime: number;
    endTime: number;
    customPlace: string | null;
    room: {
      namePrimary: string;
      building: {
        namePrimary: string;
        campus: { namePrimary: string } | null;
      } | null;
    } | null;
    teachers?: Array<{ namePrimary: string }>;
  }>;
  exams: Array<{
    id: number;
    examDate: Date | null;
    startTime: number | null;
    endTime: number | null;
    examType: number | null;
    examTakeCount: number | null;
    examMode: string | null;
    examRooms: Array<{ room: string; count: number }>;
  }>;
};

export type SubscriptionSchedule = SectionWithRelations["schedules"][number];
