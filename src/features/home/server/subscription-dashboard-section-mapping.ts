import type { SectionWithRelations } from "./dashboard-types";

export function subscriptionScheduleDateFilter(input: {
  dateFrom?: Date;
  dateTo?: Date;
}) {
  return input.dateFrom || input.dateTo
    ? {
        ...(input.dateFrom ? { gte: input.dateFrom } : {}),
        ...(input.dateTo ? { lte: input.dateTo } : {}),
      }
    : undefined;
}

type DashboardScheduleRowSource = {
  customPlace: string | null;
  date: Date | null;
  endTime: number | string | null;
  id: number;
  room: SectionWithRelations["schedules"][number]["room"];
  startTime: number | string | null;
  teachers: NonNullable<SectionWithRelations["schedules"][number]["teachers"]>;
};

type DashboardExamRowSource = {
  endTime: number | string | null;
  examDate: Date | null;
  examMode: string | null;
  examRooms?: SectionWithRelations["exams"][number]["examRooms"] | null;
  examTakeCount: number | null;
  examType: number | null;
  id: number;
  startTime: number | string | null;
};

function timeNumber(value: number | string | null) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

export function mapDashboardScheduleRow(row: DashboardScheduleRowSource) {
  return {
    id: row.id,
    date: row.date,
    startTime: timeNumber(row.startTime),
    endTime: timeNumber(row.endTime),
    customPlace: row.customPlace,
    room: row.room,
    teachers: row.teachers,
  };
}

export function mapDashboardExamRow(row: DashboardExamRowSource) {
  return {
    id: row.id,
    examDate: row.examDate,
    startTime: row.startTime === null ? null : timeNumber(row.startTime),
    endTime: row.endTime === null ? null : timeNumber(row.endTime),
    examType: row.examType,
    examTakeCount: row.examTakeCount,
    examMode: row.examMode,
    examRooms: row.examRooms ?? [],
  };
}
