import type { getCompactOverview } from "@/features/home/server/compact-overview-read-model";
import {
  summarizeExamCard,
  summarizeHomeworkCard,
  summarizeTodoCard,
} from "@/lib/mcp/tools/event-summary";

type CompactOverview = Awaited<ReturnType<typeof getCompactOverview>>;

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

export function buildMyOverviewSummaryPayload(overview: CompactOverview) {
  const samples = buildOverviewSamples(overview);
  return {
    user: {
      id: overview.user.userId,
      name: overview.user.name,
      image: overview.user.image,
    },
    overview: buildOverviewCounts(overview),
    samples: {
      dueTodos: {
        total: samples.dueTodos.length,
        items: samples.dueTodos.slice(0, 3).map(summarizeTodoCard),
      },
      dueHomeworks: {
        total: samples.dueHomeworks.length,
        items: samples.dueHomeworks.slice(0, 3).map(summarizeHomeworkCard),
      },
      upcomingExams: {
        total: samples.upcomingExams.length,
        items: samples.upcomingExams.slice(0, 3).map(summarizeExamCard),
      },
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
