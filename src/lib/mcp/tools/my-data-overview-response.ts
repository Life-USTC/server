import type { getCompactOverview } from "@/features/dashboard/server/compact-overview-read-model";
import { isRecord } from "@/lib/is-record";
import { pick } from "@/lib/mcp/compact-payload";

type CompactOverview = Awaited<ReturnType<typeof getCompactOverview>>;

function getOverviewCourseName(section: unknown) {
  if (!isRecord(section)) return null;
  if (
    isRecord(section.course) &&
    typeof section.course.namePrimary === "string"
  ) {
    return section.course.namePrimary;
  }
  if (typeof section.namePrimary === "string") {
    return section.namePrimary;
  }
  return null;
}

function summarizeOverviewTodo(value: unknown) {
  if (!isRecord(value)) return value;
  return pick(value, ["id", "title", "priority", "dueAt"]);
}

function summarizeOverviewHomework(value: unknown) {
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = pick(value, [
    "id",
    "title",
    "submissionDueAt",
  ]);
  const courseName = getOverviewCourseName(value.section);
  if (courseName) out.courseName = courseName;
  return out;
}

function summarizeOverviewExam(value: unknown) {
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = pick(value, [
    "id",
    "examDate",
    "startTime",
    "endTime",
    "examType",
    "examMode",
  ]);
  const courseName = getOverviewCourseName(value.section);
  if (courseName) out.courseName = courseName;
  return out;
}

function buildOverviewCounts(overview: CompactOverview) {
  return {
    pendingTodosCount: overview.counts.todos.incomplete,
    pendingHomeworksCount: overview.counts.pendingHomeworks,
    todaySchedulesCount: overview.counts.todaySchedules,
    upcomingExamsCount: overview.counts.upcomingExams,
  };
}

function buildOverviewSamples(overview: CompactOverview) {
  return {
    dueTodos: overview.dueTodos.items,
    dueHomeworks: overview.homeworks.items,
    upcomingExams: overview.exams.items,
  };
}

function buildOverviewSummaryGroup(
  total: number,
  items: readonly unknown[],
  summarize: (value: unknown) => unknown,
) {
  const summarizedItems = items.slice(0, 3).map(summarize);
  return {
    total,
    ...(summarizedItems.length > 0 ? { items: summarizedItems } : {}),
  };
}

export function buildMyOverviewSummaryPayload(overview: CompactOverview) {
  const samples = buildOverviewSamples(overview);
  return {
    user: {
      id: overview.user.userId,
      name: overview.user.name,
    },
    overview: buildOverviewCounts(overview),
    samples: {
      dueTodos: buildOverviewSummaryGroup(
        overview.dueTodos.total,
        samples.dueTodos,
        summarizeOverviewTodo,
      ),
      dueHomeworks: buildOverviewSummaryGroup(
        overview.homeworks.total,
        samples.dueHomeworks,
        summarizeOverviewHomework,
      ),
      upcomingExams: buildOverviewSummaryGroup(
        overview.exams.total,
        samples.upcomingExams,
        summarizeOverviewExam,
      ),
    },
  };
}

export function buildMyOverviewFullPayload(overview: CompactOverview) {
  return {
    user: {
      id: overview.user.userId,
      name: overview.user.name,
      image: overview.user.image,
      isAdmin: overview.user.isAdmin,
    },
    overview: buildOverviewCounts(overview),
    samples: buildOverviewSamples(overview),
  };
}
