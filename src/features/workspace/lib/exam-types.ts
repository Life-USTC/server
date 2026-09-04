import type { LocalizedName } from "./localized-names";

export type ExamFilter = "incomplete" | "completed" | "all";

export type WorkspaceExamRoom = {
  count: number;
  room: string;
};

export type WorkspaceExam = {
  id: number;
  examDate: Date | string | null;
  startTime: number | null;
  endTime: number | null;
  examType: number | null;
  examMode: string | null;
  examTakeCount: number | null;
  examBatch: LocalizedName | null;
  examRooms: WorkspaceExamRoom[];
};

export type WorkspaceExamSection = {
  course: LocalizedName;
  exams: WorkspaceExam[];
};

export type WorkspaceExamSubscriptions<Section extends WorkspaceExamSection> = {
  subscriptions: Array<{
    sections: Section[];
  }>;
};

export type WorkspaceExamRow<Section extends WorkspaceExamSection> = {
  id: number;
  section: Section;
  courseName: string;
  dateKey: string | null;
  examDate: Date | string | null;
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
