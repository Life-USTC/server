import { startOfShanghaiDay } from "@/lib/time/shanghai-format";

export function sectionSemesterDate(
  semester:
    | {
        endDate?: string | Date | null;
        startDate?: string | Date | null;
      }
    | null
    | undefined,
  kind: "start" | "end",
) {
  return kind === "start" ? semester?.startDate : semester?.endDate;
}

export function sectionSemesterWeekLabel(input: {
  formatMessage: (template: string, values: Record<string, string>) => string;
  semesterEnd: string | Date | null | undefined;
  semesterStart: string | Date | null | undefined;
  weekStart: Date;
  weekTemplate: string;
}) {
  const semesterStart = input.semesterStart
    ? new Date(input.semesterStart)
    : null;
  const semesterEnd = input.semesterEnd ? new Date(input.semesterEnd) : null;
  if (!semesterStart || !semesterEnd) return "";

  const weekEnd = new Date(input.weekStart);
  weekEnd.setDate(input.weekStart.getDate() + 6);
  if (weekEnd < semesterStart || input.weekStart > semesterEnd) return "";

  const semesterWeekStart = new Date(semesterStart);
  semesterWeekStart.setDate(semesterStart.getDate() - semesterStart.getDay());
  const diffMs =
    startOfShanghaiDay(input.weekStart).getTime() -
    startOfShanghaiDay(semesterWeekStart).getTime();
  const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  return input.formatMessage(input.weekTemplate, { week: String(week) });
}
