import { Prisma } from "@/generated/prisma/client";
import {
  addCampusDays,
  campusDateKeyRange,
  campusWeekStartKey,
  requireCampusDateKeyForValue,
  toCampusDateKey,
} from "@/lib/time/campus-date";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

export type ContributionCell = {
  date: string;
  count: number;
};

type ContributionEvent = {
  createdAt: Date;
};

type PublicProfileUploadStatsRow = {
  createdAt: Date | null;
  totalUploads: bigint;
};

type PublicProfileHomeworkCompletionRow = {
  completedAt: Date;
};

type ContributionPrisma = {
  $queryRaw<T>(query: Prisma.Sql): Promise<T>;
  comment: {
    findMany(input: unknown): Promise<ContributionEvent[]>;
  };
  homework: {
    findMany(input: unknown): Promise<ContributionEvent[]>;
  };
};

export async function buildUserProfileContributions(
  prisma: ContributionPrisma,
  userId: string,
  referenceNow: Date = new Date(),
) {
  const today = shanghaiDayjs(referenceNow).startOf("day");
  const startDate = today.subtract(364, "day").startOf("day");
  const [commentEvents, uploadStats, completionEvents, homeworkEvents] =
    await Promise.all([
      prisma.comment.findMany({
        where: {
          userId,
          createdAt: { gte: startDate.toDate() },
          status: { in: ["active", "softbanned"] },
        },
        select: { createdAt: true },
      }),
      prisma.$queryRaw<PublicProfileUploadStatsRow[]>(Prisma.sql`
        SELECT *
        FROM public.get_public_profile_upload_stats(
          ${userId},
          ${startDate.toDate()}
        )
      `),
      prisma.$queryRaw<PublicProfileHomeworkCompletionRow[]>(Prisma.sql`
        SELECT *
        FROM public.get_public_profile_homework_completions(
          ${userId},
          ${startDate.toDate()}
        )
      `),
      prisma.homework.findMany({
        where: {
          createdById: userId,
          createdAt: { gte: startDate.toDate() },
          deletedAt: null,
        },
        select: { createdAt: true },
      }),
    ]);

  const contributionMap = new Map<string, number>();
  const addContribution = (date: Date) => {
    const key = toCampusDateKey(date);
    if (!key) return;
    contributionMap.set(key, (contributionMap.get(key) ?? 0) + 1);
  };

  for (const item of commentEvents) addContribution(item.createdAt);
  for (const item of uploadStats) {
    if (item.createdAt) addContribution(item.createdAt);
  }
  for (const item of completionEvents) addContribution(item.completedAt);
  for (const item of homeworkEvents) addContribution(item.createdAt);

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

  return {
    totalContributions,
    totalUploads: Number(uploadStats[0]?.totalUploads ?? 0n),
    weeks,
  };
}
