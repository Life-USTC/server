import { withHomeworkItemState } from "@/features/homeworks/server/homework-item-state";
import {
  countUpcomingSubscribedExams,
  listSubscribedHomeworks,
  listSubscribedSchedules,
  listUpcomingSubscribedExams,
} from "@/features/subscriptions/server/subscription-read-model";
import {
  countDueTodos,
  listDueTodoSamples,
  listTodoSummary,
} from "@/features/todos/server/todo-service";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { runCloudflareTraceSpan } from "@/lib/adapters/cloudflare-runtime";
import { prisma } from "@/lib/db/prisma";
import {
  type WorkspaceOverviewStage,
  writeWorkspaceOverviewStageAnalytics,
} from "@/lib/metrics/analytics-engine";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import { serializeScheduleTimeFields } from "@/shared/lib/schedule-serialization";

const DEFAULT_OVERVIEW_LIMIT = 3;
const DEFAULT_HOMEWORK_WINDOW_DAYS = 7;

function requiredDate(value: Date | null | undefined, label: string) {
  if (value instanceof Date) return value;
  throw new Error(`Failed to derive ${label}`);
}

function shanghaiDateOnlyStart(input: Date) {
  return requiredDate(parseDateInput(formatShanghaiDate(input)), "day start");
}

async function runOverviewStage<T>(
  stage: WorkspaceOverviewStage,
  work: () => Promise<T>,
) {
  const startMs = Date.now();
  try {
    const result = await runCloudflareTraceSpan(
      `workspace.overview.${stage}`,
      {},
      work,
    );
    writeWorkspaceOverviewStageAnalytics({
      ioObservedDurationMs: Date.now() - startMs,
      stage,
      status: "success",
    });
    return result;
  } catch (error) {
    writeWorkspaceOverviewStageAnalytics({
      ioObservedDurationMs: Date.now() - startMs,
      stage,
      status: "error",
    });
    throw error;
  }
}

export async function getCompactOverview(
  userId: string,
  {
    atTime = new Date(),
    homeworkWindowDays = DEFAULT_HOMEWORK_WINDOW_DAYS,
    limit = DEFAULT_OVERVIEW_LIMIT,
    locale = DEFAULT_LOCALE,
  }: {
    atTime?: Date;
    homeworkWindowDays?: number;
    limit?: number;
    locale?: AppLocale;
  } = {},
) {
  const now = atTime;
  const todayStart = shanghaiDateOnlyStart(now);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const homeworkWindowEnd = shanghaiDayjs(now)
    .add(homeworkWindowDays, "day")
    .toDate();

  const [user, todos, dueTodosCount, dueTodos] = await Promise.all([
    runOverviewStage("user_sections", () =>
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          image: true,
          isAdmin: true,
          name: true,
          subscribedSections: {
            where: { retiredAt: null },
            select: { id: true },
          },
        },
      }),
    ),
    runOverviewStage("todo_summary", () =>
      listTodoSummary({
        filters: { completed: false },
        now,
        take: limit,
        userId,
      }),
    ),
    runOverviewStage("due_todo_count", () =>
      countDueTodos({
        completed: false,
        dueAtFrom: now,
        dueAtTo: homeworkWindowEnd,
        includeDueAtTo: true,
        userId,
      }),
    ),
    runOverviewStage("due_todo_sample", () =>
      listDueTodoSamples({
        completed: false,
        dueAtFrom: now,
        dueAtTo: homeworkWindowEnd,
        includeDueAtTo: true,
        take: limit,
        userId,
      }),
    ),
  ]);
  const sectionIds =
    user?.subscribedSections.map((section) => section.id) ?? [];

  const [
    [
      pendingHomeworksCount,
      todaySchedulesCount,
      upcomingExamsCount,
      dueSoonHomeworksCount,
    ],
    [schedules, dueSoonHomeworksRaw, upcomingExams],
  ] = await Promise.all([
    runOverviewStage("counts", () =>
      sectionIds.length > 0
        ? Promise.all([
            prisma.homework.count({
              where: {
                deletedAt: null,
                homeworkCompletions: { none: { userId } },
                sectionId: { in: sectionIds },
              },
            }),
            prisma.schedule.count({
              where: {
                date: { gte: todayStart, lt: tomorrowStart },
                sectionId: { in: sectionIds },
              },
            }),
            countUpcomingSubscribedExams({
              atTime: now,
              sectionIds,
            }),
            prisma.homework.count({
              where: {
                deletedAt: null,
                homeworkCompletions: { none: { userId } },
                sectionId: { in: sectionIds },
                submissionDueAt: { gte: now, lte: homeworkWindowEnd },
              },
            }),
          ])
        : Promise.resolve<[number, number, number, number]>([0, 0, 0, 0]),
    ),
    runOverviewStage("lists", () =>
      sectionIds.length > 0
        ? Promise.all([
            listSubscribedSchedules(userId, {
              dateFrom: todayStart,
              dateTo: todayStart,
              limit,
              locale,
              sectionIds,
            }),
            listSubscribedHomeworks(userId, {
              completed: false,
              dueAtFrom: now,
              dueAtTo: homeworkWindowEnd,
              includeEditors: true,
              limit,
              locale,
              requireDueDate: true,
              sectionIds,
            }),
            listUpcomingSubscribedExams(userId, {
              atTime: now,
              limit,
              locale,
              sectionIds,
            }),
          ])
        : Promise.resolve<[never[], never[], never[]]>([[], [], []]),
    ),
  ]);

  const dueSoonHomeworks = await runOverviewStage("item_state", () =>
    withHomeworkItemState(dueSoonHomeworksRaw),
  );

  return {
    user: {
      userId: user?.id ?? userId,
      name: user?.name ?? null,
      image: user?.image ?? null,
      isAdmin: user?.isAdmin ?? false,
    },
    anchor: {
      atTime: now,
      todayStart,
      tomorrowStart,
      homeworkWindowDays,
      homeworkWindowEnd,
      limit,
    },
    counts: {
      todos: todos.counts,
      pendingHomeworks: pendingHomeworksCount,
      dueSoonHomeworks: dueSoonHomeworksCount,
      todaySchedules: todaySchedulesCount,
      upcomingExams: upcomingExamsCount,
    },
    schedules: {
      total: todaySchedulesCount,
      items: schedules.map(serializeScheduleTimeFields),
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
      total: dueSoonHomeworksCount,
      items: dueSoonHomeworks,
    },
    exams: {
      total: upcomingExamsCount,
      items: upcomingExams,
    },
  };
}
