import {
  addCampusDays,
  campusDateKeyRange,
  campusWeekStartKey,
  requireCampusDateKeyForValue,
} from "@/lib/time/campus-date";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

export type ContributionCell = {
  date: string;
  count: number;
};

type ContributionDayRow = {
  date: string;
  count: bigint;
};

type ContributionPrisma = {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): PromiseLike<T>;
};

export async function loadUserProfileContributionDays(
  prisma: ContributionPrisma,
  userId: string,
  startAt: Date,
) {
  const rows = await prisma.$queryRaw<ContributionDayRow[]>`
    SELECT
      to_char(
        (events."eventAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Shanghai',
        'YYYY-MM-DD'
      ) AS "date",
      COUNT(*) AS "count"
    FROM (
      SELECT "createdAt" AS "eventAt"
      FROM "Comment"
      WHERE "userId" = ${userId}
        AND "createdAt" >= ${startAt}
        AND "status" IN ('active', 'softbanned')

      UNION ALL

      SELECT upload_stats."createdAt" AS "eventAt"
      FROM public.get_public_profile_upload_stats(${userId}, ${startAt}) AS upload_stats
      WHERE upload_stats."createdAt" IS NOT NULL

      UNION ALL

      SELECT completion_stats."completedAt" AS "eventAt"
      FROM public.get_public_profile_homework_completions(${userId}, ${startAt}) AS completion_stats

      UNION ALL

      SELECT "createdAt" AS "eventAt"
      FROM "Homework"
      WHERE "createdById" = ${userId}
        AND "createdAt" >= ${startAt}
        AND "deletedAt" IS NULL
    ) AS events
    GROUP BY 1
    ORDER BY 1
  `;

  return rows.map(({ count, date }) => ({ count: Number(count), date }));
}

export async function loadPublicProfileUploadCount(
  prisma: ContributionPrisma,
  userId: string,
  since: Date,
) {
  const [row] = await prisma.$queryRaw<{ totalUploads: bigint }[]>`
    SELECT "totalUploads"
    FROM public.get_public_profile_upload_stats(${userId}, ${since})
  `;

  return Number(row?.totalUploads ?? 0n);
}

export async function buildUserProfileContributions(
  prisma: ContributionPrisma,
  userId: string,
  referenceNow: Date = new Date(),
) {
  const today = shanghaiDayjs(referenceNow).startOf("day");
  const startDate = today.subtract(364, "day").startOf("day");
  const contributionDays = await loadUserProfileContributionDays(
    prisma,
    userId,
    startDate.toDate(),
  );
  const contributionMap = new Map(
    contributionDays.map(({ count, date }) => [date, count]),
  );

  const startDateKey = requireCampusDateKeyForValue(startDate.toDate());
  const todayKey = requireCampusDateKeyForValue(today.toDate());
  const gridStartKey = campusWeekStartKey(startDateKey);
  const gridEndKey = addCampusDays(campusWeekStartKey(todayKey), 6);
  const days: ContributionCell[] = campusDateKeyRange(
    gridStartKey,
    gridEndKey,
  ).map((key) => ({ date: key, count: contributionMap.get(key) ?? 0 }));
  const weeks: ContributionCell[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  const totalContributions = Array.from(contributionMap.values()).reduce(
    (sum, count) => sum + count,
    0,
  );

  return { totalContributions, weeks };
}
