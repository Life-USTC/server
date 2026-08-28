import { loadOverviewTodoBundle } from "@/features/todos/server/todo-service";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { runCloudflareTraceSpan } from "@/lib/adapters/cloudflare-runtime";
import { withUserDbContext } from "@/lib/db/prisma";
import { elapsedMs, monotonicNowMs } from "@/lib/log/observability-clock";
import {
  type WorkspaceOverviewStage,
  writeWorkspaceOverviewStageAnalytics,
} from "@/lib/metrics/analytics-engine";
import { parseRequiredDateInput } from "@/lib/time/date-time-from-hhmm";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import { serializeScheduleTimeFields } from "@/shared/lib/schedule-serialization";
import { loadOverviewSubscriptionReads } from "./compact-overview-subscription-bundle";

const DEFAULT_OVERVIEW_LIMIT = 3;
const DEFAULT_HOMEWORK_WINDOW_DAYS = 7;

async function runOverviewStage<T>(
  stage: WorkspaceOverviewStage,
  work: () => Promise<T>,
) {
  const startMs = monotonicNowMs();
  let status: "error" | "success" = "error";
  try {
    const result = await runCloudflareTraceSpan(
      `workspace.overview.${stage}`,
      {},
      work,
    );
    status = "success";
    return result;
  } finally {
    writeWorkspaceOverviewStageAnalytics({
      ioObservedDurationMs: elapsedMs(startMs),
      stage,
      status,
    });
  }
}

export async function getCompactOverview(
  userId: string,
  {
    atTime = new Date(),
    homeworkWindowDays = DEFAULT_HOMEWORK_WINDOW_DAYS,
    includeSamples = true,
    limit = DEFAULT_OVERVIEW_LIMIT,
    locale = DEFAULT_LOCALE,
  }: {
    atTime?: Date;
    homeworkWindowDays?: number;
    /** When false, skip sample list queries (GraphQL counts-only). REST/MCP keep samples. */
    includeSamples?: boolean;
    limit?: number;
    locale?: AppLocale;
  } = {},
) {
  // Keep the aggregate orchestration outside a shared interactive
  // transaction. Owner-scoped reads establish their own RLS contexts while
  // public catalog reads can use the bounded Prisma pool concurrently.
  const todayStart = parseRequiredDateInput(formatShanghaiDate(atTime));
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const homeworkWindowEnd = shanghaiDayjs(atTime)
    .add(homeworkWindowDays, "day")
    .toDate();

  const todoBundlePromise = loadOverviewTodoBundle({
    userId,
    now: atTime,
    homeworkWindowEnd,
    includeSamples,
    limit,
    runTodoSummary: (work) => runOverviewStage("todo_summary", work),
    runDueTodoCount: (work) => runOverviewStage("due_todo_count", work),
    runDueTodoSample: (work) => runOverviewStage("due_todo_sample", work),
  });

  const user = await runOverviewStage("user_sections", () =>
    withUserDbContext(userId, (tx) =>
      tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          image: true,
          isAdmin: true,
          name: true,
          sectionSubscriptions: {
            where: { section: { retiredAt: null } },
            select: { sectionId: true },
          },
        },
      }),
    ),
  );
  const sectionIds =
    user?.sectionSubscriptions?.map((row) => row.sectionId) ?? [];

  const [todoBundle, overviewReads] = await Promise.all([
    todoBundlePromise,
    loadOverviewSubscriptionReads({
      atTime,
      homeworkWindowEnd,
      includeSamples,
      limit,
      locale,
      runStage: runOverviewStage,
      sectionIds,
      todayStart,
      tomorrowStart,
      userId,
    }),
  ]);
  const { todos, dueTodosCount, dueTodos } = todoBundle;

  return {
    user: {
      userId: user?.id ?? userId,
      name: user?.name ?? null,
      image: user?.image ?? null,
      isAdmin: user?.isAdmin ?? false,
    },
    anchor: {
      atTime,
      todayStart,
      tomorrowStart,
      homeworkWindowDays,
      homeworkWindowEnd,
      limit,
    },
    counts: {
      todos: todos.counts,
      pendingHomeworks: overviewReads.counts.pendingHomeworksCount,
      dueSoonHomeworks: overviewReads.counts.dueSoonHomeworksCount,
      todaySchedules: overviewReads.counts.todaySchedulesCount,
      upcomingExams: overviewReads.counts.upcomingExamsCount,
    },
    schedules: {
      total: overviewReads.counts.todaySchedulesCount,
      items: overviewReads.schedules.map(serializeScheduleTimeFields),
    },
    todos: {
      counts: todos.counts,
      items: todos.todos,
    },
    dueTodos: {
      total: dueTodosCount,
      items: dueTodos,
    },
    homeworks: {
      total: overviewReads.counts.dueSoonHomeworksCount,
      items: overviewReads.dueSoonHomeworks,
    },
    exams: {
      total: overviewReads.counts.upcomingExamsCount,
      items: overviewReads.upcomingExams,
    },
  };
}
