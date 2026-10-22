import {
  getHomeworkCommentCounts,
  type HomeworkItemWithState,
  withHomeworkItemState,
} from "@/features/homeworks/server/homework-item-state";
import {
  fetchSubscribedHomeworkRlsSnapshot,
  localizeSubscribedHomeworkWorkspaceItems,
} from "@/features/subscriptions/server/subscription-homework-list";
import { buildSubscribedHomeworkQuery } from "@/features/subscriptions/server/subscription-homework-read-helpers";
import { getUserSubscriptionKinds } from "@/features/subscriptions/server/subscription-kind";
import {
  listTodaySubscribedSchedulesWithCount,
  listUpcomingSubscribedExamsWithCount,
} from "@/features/subscriptions/server/subscription-read-model";
import type { HomeworkWithSection } from "@/features/subscriptions/server/subscription-workspace-types";
import type { Prisma } from "@/generated/prisma/client";
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
  dueSoonHomeworks: HomeworkItemWithState<HomeworkWithSection>[];
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

function countPendingOverviewHomeworksInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  atTime: Date,
  sectionIds: readonly number[],
) {
  const query = buildSubscribedHomeworkQuery({
    completed: false,
    includeDeleted: false,
    now: atTime,
    requireDueDate: false,
    sectionIds,
    userId,
  });
  return tx.homework.count({
    where: query.where,
  });
}

function loadOverviewHomeworkViewerState(
  userId: string,
  homeworkIds: readonly string[],
) {
  return Promise.all([
    getUserSubscriptionKinds(userId),
    getHomeworkCommentCounts(homeworkIds, userId),
  ]).then(([subscriptionKinds, commentCounts]) => ({
    commentCounts,
    subscriptionKinds,
  }));
}

async function loadOverviewHomeworkRlsReads(input: {
  atTime: Date;
  homeworkWindowEnd: Date;
  includeSamples: boolean;
  limit: number;
  sectionIds: readonly number[];
  userId: string;
}) {
  const dueSoonQuery = buildSubscribedHomeworkQuery({
    completed: false,
    dueAtFrom: input.atTime,
    dueAtTo: input.homeworkWindowEnd,
    includeDeleted: false,
    limit: input.includeSamples ? input.limit : undefined,
    now: input.atTime,
    requireDueDate: true,
    sectionIds: [...input.sectionIds],
    userId: input.userId,
  });

  return withUserDbContext(input.userId, async (tx) => {
    const [pendingHomeworksCount, dueSoonRls] = await Promise.all([
      countPendingOverviewHomeworksInTransaction(
        tx,
        input.userId,
        input.atTime,
        input.sectionIds,
      ),
      fetchSubscribedHomeworkRlsSnapshot(
        tx,
        input.userId,
        dueSoonQuery,
        input.includeSamples,
      ),
    ]);
    // Nested viewer-scoped reads reuse this RLS transaction. Left to the
    // serial tail that localizes the samples, the same two queries each open
    // their own transaction and pay BEGIN, set_config and COMMIT for it.
    const viewerState =
      dueSoonRls.homeworkIds.length === 0
        ? undefined
        : await loadOverviewHomeworkViewerState(
            input.userId,
            dueSoonRls.homeworkIds,
          );
    return { dueSoonRls, pendingHomeworksCount, viewerState };
  });
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
      includeItems: includeSamples,
      limit: includeSamples ? limit : undefined,
      locale,
      sectionIds,
    },
  );
  const examsOverviewPromise = listUpcomingSubscribedExamsWithCount(userId, {
    atTime,
    includeItems: includeSamples,
    limit: includeSamples ? limit : undefined,
    locale,
    sectionIds,
  });
  const homeworkRlsPromise = loadOverviewHomeworkRlsReads({
    atTime,
    homeworkWindowEnd,
    includeSamples,
    limit,
    sectionIds,
    userId,
  });

  if (!includeSamples) {
    const [homeworkRls, schedulesOverview, examsOverview] = await runStage(
      "counts",
      () =>
        Promise.all([
          homeworkRlsPromise,
          schedulesOverviewPromise,
          examsOverviewPromise,
        ]),
    );

    return {
      counts: {
        pendingHomeworksCount: homeworkRls.pendingHomeworksCount,
        todaySchedulesCount: schedulesOverview.total,
        upcomingExamsCount: examsOverview.total,
        dueSoonHomeworksCount: homeworkRls.dueSoonRls.total,
      },
      dueSoonHomeworks: [],
      schedules: [],
      upcomingExams: [],
    };
  }

  const dueSoonHomeworksRawPromise = homeworkRlsPromise.then((homeworkRls) => {
    if (homeworkRls.dueSoonRls.homeworkIds.length === 0) {
      return [];
    }
    return runStage("lists", () =>
      localizeSubscribedHomeworkWorkspaceItems(
        homeworkRls.dueSoonRls,
        locale,
        input.userId,
        homeworkRls.viewerState?.subscriptionKinds,
      ),
    );
  });
  const dueSoonHomeworksPromise = Promise.all([
    dueSoonHomeworksRawPromise,
    homeworkRlsPromise,
  ]).then(([raw, homeworkRls]) =>
    runStage("item_state", () =>
      withHomeworkItemState(
        raw,
        userId,
        homeworkRls.viewerState?.commentCounts,
      ),
    ),
  );

  const [
    [homeworkRls, schedulesOverview, upcomingExamsOverview],
    dueSoonHomeworks,
  ] = await Promise.all([
    runStage("counts", () =>
      Promise.all([
        homeworkRlsPromise,
        schedulesOverviewPromise,
        examsOverviewPromise,
      ]),
    ),
    dueSoonHomeworksPromise,
  ]);

  return {
    counts: {
      pendingHomeworksCount: homeworkRls.pendingHomeworksCount,
      todaySchedulesCount: schedulesOverview.total,
      upcomingExamsCount: upcomingExamsOverview.total,
      dueSoonHomeworksCount: homeworkRls.dueSoonRls.total,
    },
    dueSoonHomeworks,
    schedules: schedulesOverview.items,
    upcomingExams: upcomingExamsOverview.items,
  };
}
