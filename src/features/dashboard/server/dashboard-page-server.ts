import { parseInteger } from "@/lib/api/request-integers";
import { allowE2EDebugAuth } from "@/lib/auth/auth-config";
import { hasRequestAuthSignal } from "@/lib/auth/request-auth-signal";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { parseShanghaiDateTimeLocalInput } from "@/lib/time/shanghai-format";

export {
  HOMEWORK_DESCRIPTION_MAX_LENGTH,
  HOMEWORK_TITLE_MAX_LENGTH,
  TODO_CONTENT_MAX_LENGTH,
  TODO_PRIORITIES,
  TODO_TITLE_MAX_LENGTH,
} from "@/features/dashboard/lib/dashboard-limits";

const SIGNED_IN_TABS = new Set([
  "overview",
  "calendar",
  "bus",
  "links",
  "homeworks",
  "todos",
  "exams",
  "subscriptions",
]);

export async function getDashboardUserId(request: Request) {
  if (!hasRequestAuthSignal(request.headers)) return null;
  const { getSessionFromHeaders } = await import("@/lib/auth/core");
  return (await getSessionFromHeaders(request.headers))?.user?.id ?? null;
}

export function normalizeDashboardTab(tab: string | null, signedIn: boolean) {
  if (signedIn && tab && SIGNED_IN_TABS.has(tab)) return tab;
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
  if (!allowE2EDebugAuth || !value) return undefined;
  const parsed = parseDateInput(value);
  return parsed instanceof Date ? parsed : undefined;
}

export function parsePositiveCalendarSemester(value: string | null) {
  const parsed = parseInteger(value);
  return parsed !== null && parsed > 0 ? parsed : undefined;
}

export function parseOptionalLocalDateTime(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return { ok: true as const, value: null };
  const parsed = parseShanghaiDateTimeLocalInput(raw);
  return parsed ? { ok: true as const, value: parsed } : { ok: false as const };
}

export function serializeOptionalLocalDateTime(
  value: FormDataEntryValue | null,
) {
  const parsed = parseOptionalLocalDateTime(value);
  if (!parsed.ok) return parsed;
  return {
    ok: true as const,
    value: parsed.value ? toShanghaiIsoString(parsed.value) : "",
  };
}
