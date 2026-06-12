import dayjs from "dayjs";

export type ContributionCell = {
  date: string;
  count: number;
};

type ContributionEvent = {
  createdAt: Date;
};

type CompletionEvent = {
  completedAt: Date;
};

type ContributionPrisma = {
  comment: {
    findMany(input: unknown): Promise<ContributionEvent[]>;
  };
  homework: {
    findMany(input: unknown): Promise<ContributionEvent[]>;
  };
  homeworkCompletion: {
    findMany(input: unknown): Promise<CompletionEvent[]>;
  };
  upload: {
    findMany(input: unknown): Promise<ContributionEvent[]>;
  };
};

export async function buildUserProfileContributions(
  prisma: ContributionPrisma,
  userId: string,
) {
  const today = dayjs().startOf("day");
  const startDate = today.subtract(364, "day").startOf("day");
  const [commentEvents, uploadEvents, completionEvents, homeworkEvents] =
    await Promise.all([
      prisma.comment.findMany({
        where: {
          userId,
          createdAt: { gte: startDate.toDate() },
          status: { in: ["active", "softbanned"] },
        },
        select: { createdAt: true },
      }),
      prisma.upload.findMany({
        where: { userId, createdAt: { gte: startDate.toDate() } },
        select: { createdAt: true },
      }),
      prisma.homeworkCompletion.findMany({
        where: { userId, completedAt: { gte: startDate.toDate() } },
        select: { completedAt: true },
      }),
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
    const key = dayjs(date).format("YYYY-MM-DD");
    contributionMap.set(key, (contributionMap.get(key) ?? 0) + 1);
  };

  for (const item of commentEvents) addContribution(item.createdAt);
  for (const item of uploadEvents) addContribution(item.createdAt);
  for (const item of completionEvents) addContribution(item.completedAt);
  for (const item of homeworkEvents) addContribution(item.createdAt);

  const gridStart = startDate.startOf("week");
  const gridEnd = today.endOf("week");
  const days: ContributionCell[] = Array.from(
    { length: gridEnd.diff(gridStart, "day") + 1 },
    (_, index) => {
      const date = gridStart.add(index, "day");
      const key = date.format("YYYY-MM-DD");
      return { date: key, count: contributionMap.get(key) ?? 0 };
    },
  );
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
