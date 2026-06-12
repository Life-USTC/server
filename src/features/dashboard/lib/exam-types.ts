import type { LocalizedName } from "./localized-names";

export type ExamFilter = "incomplete" | "completed" | "all";

export type DashboardExamRoom = {
  count: number;
  room: string;
};

export type DashboardExam = {
  id: number;
  examDate: Date | string | null;
  startTime: number | null;
  endTime: number | null;
  examType: number | null;
  examMode: string | null;
  examTakeCount: number | null;
  examBatch: LocalizedName | null;
  examRooms: DashboardExamRoom[];
};

export type DashboardExamSection = {
  course: LocalizedName;
  exams: DashboardExam[];
};

export type DashboardExamSubscriptions<Section extends DashboardExamSection> = {
  subscriptions: Array<{
    sections: Section[];
  }>;
};

export type DashboardExamRow<Section extends DashboardExamSection> = {
  id: number;
  section: Section;
  courseName: string;
  dateKey: string | null;
  startTime: number | null;
  endTime: number | null;
  examType: number | null;
  examMode: string | null;
  examTakeCount: number | null;
  examBatch: LocalizedName | null;
  rooms: string;
  completed: boolean;
};

export type ExamLabels = {
  count: string;
  final: string;
  midterm: string;
};
