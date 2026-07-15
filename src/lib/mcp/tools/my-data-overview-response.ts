import type { getCompactOverview } from "@/features/dashboard/server/compact-overview-read-model";

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
