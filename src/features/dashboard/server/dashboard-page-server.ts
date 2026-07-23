import { isWorkspaceDashboardTab } from "@/features/dashboard/lib/dashboard-nav";
import { allowE2EDebugAuth } from "@/lib/auth/auth-config";
import { hasRequestAuthSignal } from "@/lib/auth/request-auth-signal";
import { parseInteger } from "@/lib/integers";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

export async function getDashboardUserId(request: Request) {
  if (!hasRequestAuthSignal(request.headers)) return null;
  const { getSessionFromHeaders } = await import("@/lib/auth/core");
  return (await getSessionFromHeaders(request.headers))?.user?.id ?? null;
}

export function normalizeDashboardTab(tab: string | null, signedIn: boolean) {
  if (signedIn && isWorkspaceDashboardTab(tab)) return tab;
  if (signedIn) return "overview";
  return tab === "links" ? "links" : "bus";
}

export function dashboardHomeworkItem(homework: {
  id: string;
  publishedAt: Date | null;
  section: {
    course: { namePrimary: string | null } | null;
    jwId: number | null;
  } | null;
  submissionDueAt: Date | null;
  submissionStartAt: Date | null;
  title: string;
  homeworkCompletions?: Array<unknown>;
}) {
  return {
    completed: (homework.homeworkCompletions?.length ?? 0) > 0,
    id: homework.id,
    title: homework.title,
    publishedAt: homework.publishedAt,
    submissionStartAt: homework.submissionStartAt,
    submissionDueAt: homework.submissionDueAt,
    section: homework.section
      ? {
          jwId: homework.section.jwId,
          course: {
            namePrimary: homework.section.course?.namePrimary ?? null,
          },
        }
      : null,
  };
}

export function calendarDateKey(value: Date | string | null | undefined) {
  return value ? shanghaiDayjs(value).format("YYYY-MM-DD") : null;
}

export function parseSnapshotReferenceTime(value: string | null) {
  if (!allowE2EDebugAuth() || !value) return undefined;
  const parsed = parseDateInput(value);
  return parsed instanceof Date ? parsed : undefined;
}

export function parsePositiveCalendarSemester(value: string | null) {
  const parsed = parseInteger(value);
  return parsed !== null && parsed > 0 ? parsed : undefined;
}
