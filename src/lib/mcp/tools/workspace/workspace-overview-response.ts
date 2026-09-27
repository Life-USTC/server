import type { getCompactOverview } from "@/features/workspace/server/compact-overview-read-model";
import { pick } from "@/lib/mcp/compact-helpers";

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

export function buildMyOverviewCompactPayload(overview: CompactOverview) {
  const full = buildMyOverviewFullPayload(overview);
  return {
    user: full.user,
    overview: full.overview,
    samples: {
      dueTodos: full.samples.dueTodos.map((todo) =>
        pick(todo, ["id", "title", "priority", "dueAt"]),
      ),
      dueHomeworks: full.samples.dueHomeworks.map((homework) => ({
        ...pick(homework, [
          "id",
          "title",
          "publishedAt",
          "submissionStartAt",
          "submissionDueAt",
          "completionRequired",
          "completion",
        ]),
        section: homework.section
          ? {
              ...pick(homework.section, ["jwId"]),
              course: homework.section.course
                ? pick(homework.section.course, ["namePrimary"])
                : null,
            }
          : null,
      })),
      upcomingExams: full.samples.upcomingExams.map((exam) => ({
        ...pick(exam, [
          "id",
          "jwId",
          "examDate",
          "startTime",
          "endTime",
          "examMode",
          "examType",
          "examTakeCount",
          "examRooms",
          "examBatch",
        ]),
        section: {
          ...pick(exam.section, ["id", "jwId", "code"]),
          course: pick(exam.section.course, [
            "id",
            "jwId",
            "code",
            "namePrimary",
          ]),
          semester: exam.section.semester,
        },
      })),
    },
  };
}
