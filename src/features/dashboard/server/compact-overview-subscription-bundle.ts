import { withHomeworkItemState } from "@/features/homeworks/server/homework-item-state";
import {
  listDueSoonSubscribedHomeworksWithCount,
  listTodaySubscribedSchedulesWithCount,
  listUpcomingSubscribedExamsWithCount,
} from "@/features/subscriptions/server/subscription-read-model";
import type { AppLocale } from "@/i18n/config";
import { withUserDbContext } from "@/lib/db/prisma";
import type { WorkspaceOverviewStage } from "@/lib/metrics/analytics-engine";

type OverviewSubscriptionReads = {
  counts: {
    pendingHomeworksCount: number;
    todaySchedulesCount: number;
    upcomingExamsCount: number;
    dueSoonHomeworksCount: number;
  };
  dueSoonHomeworks: Awaited<ReturnType<typeof withHomeworkItemState>>;
  schedules: Awaited<
    ReturnType<typeof listTodaySubscribedSchedulesWithCount>
  >["items"];
  upcomingExams: Awaited<
    ReturnType<typeof listUpcomingSubscribedExamsWithCount>
  >["items"];
};

const emptySubscriptionReads: OverviewSubscriptionReads = {
  counts: {
    pendingHomeworksCount: 0,
    todaySchedulesCount: 0,
    upcomingExamsCount: 0,
    dueSoonHomeworksCount: 0,
  },
  dueSoonHomeworks: [],
  schedules: [],
  upcomingExams: [],
};

function countPendingOverviewHomeworks(
  userId: string,
  sectionIds: readonly number[],
) {
  return withUserDbContext(userId, (tx) =>
    tx.homework.count({
      where: {
        deletedAt: null,
        homeworkCompletions: { none: { userId } },
        sectionId: { in: [...sectionIds] },
      },
    }),
  );
}

export async function loadOverviewSubscriptionReads(input: {
  atTime: Date;
  homeworkWindowEnd: Date;
  includeSamples?: boolean;
  limit: number;
  locale: AppLocale;
  runStage: <T>(
    stage: WorkspaceOverviewStage,
    work: () => Promise<T>,
  ) => Promise<T>;
  sectionIds: readonly number[];
  todayStart: Date;
  tomorrowStart: Date;
  userId: string;
}): Promise<OverviewSubscriptionReads> {
  const {
    atTime,
    homeworkWindowEnd,
    includeSamples = true,
    limit,
    locale,
    runStage,
    sectionIds,
    todayStart,
    tomorrowStart,
    userId,
  } = input;

  if (sectionIds.length === 0) {
    return emptySubscriptionReads;
  }

  const schedulesOverviewPromise = listTodaySubscribedSchedulesWithCount(
    userId,
    {
      todayStart,
      tomorrowStart,
      // Counts-only callers still need totals; limit 1 keeps the paired findMany cheap.
      limit: includeSamples ? limit : 1,
      locale,
      sectionIds,
    },
  );
  const examsOverviewPromise = listUpcomingSubscribedExamsWithCount(userId, {
    atTime,
    limit: includeSamples ? limit : 1,
    locale,
    sectionIds,
  });
  const dueSoonHomeworksOverviewPromise =
    listDueSoonSubscribedHomeworksWithCount(userId, {
      dueAtFrom: atTime,
      dueAtTo: homeworkWindowEnd,
      limit: includeSamples ? limit : 1,
      locale,
      sectionIds,
    });

  if (!includeSamples) {
    const [
      pendingHomeworksCount,
      todaySchedulesCount,
      upcomingExamsCount,
      dueSoonHomeworksCount,
    ] = await runStage("counts", () =>
      Promise.all([
        countPendingOverviewHomeworks(userId, sectionIds),
        schedulesOverviewPromise.then((result) => result.total),
        examsOverviewPromise.then((result) => result.total),
        dueSoonHomeworksOverviewPromise.then((result) => result.total),
      ]),
    );

    return {
      counts: {
        pendingHomeworksCount,
        todaySchedulesCount,
        upcomingExamsCount,
        dueSoonHomeworksCount,
      },
      dueSoonHomeworks: [],
      schedules: [],
      upcomingExams: [],
    };
  }

  const dueSoonHomeworksRawPromise = dueSoonHomeworksOverviewPromise.then(
    (result) => result.items,
  );
  const dueSoonHomeworksPromise = dueSoonHomeworksRawPromise.then((raw) =>
    runStage("item_state", () => withHomeworkItemState(raw, userId)),
  );

  const [
    [
      pendingHomeworksCount,
      dueSoonHomeworksCount,
      todaySchedulesCount,
      upcomingExamsCount,
    ],
    [schedulesOverview, upcomingExamsOverview],
    dueSoonHomeworks,
  ] = await Promise.all([
    runStage("counts", () =>
      Promise.all([
        countPendingOverviewHomeworks(userId, sectionIds),
        dueSoonHomeworksOverviewPromise.then((result) => result.total),
        schedulesOverviewPromise.then((result) => result.total),
        examsOverviewPromise.then((result) => result.total),
      ]),
    ),
    runStage("lists", () =>
      Promise.all([
        schedulesOverviewPromise,
        // Include homework in the lists fan-out so its latency is attributed
        // to `lists` while `item_state` still chains off the same promise.
        dueSoonHomeworksRawPromise,
        examsOverviewPromise,
      ]).then(([schedules, , exams]) => [schedules, exams] as const),
    ),
    dueSoonHomeworksPromise,
  ]);

  return {
    counts: {
      pendingHomeworksCount,
      todaySchedulesCount,
      upcomingExamsCount,
      dueSoonHomeworksCount,
    },
    dueSoonHomeworks,
    schedules: schedulesOverview.items,
    upcomingExams: upcomingExamsOverview.items,
  };
}
