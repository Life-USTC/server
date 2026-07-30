import { withUserDbContext } from "@/lib/db/prisma";

export type DashboardUserSummary = {
  id: string;
  name: string | null;
  username: string | null;
};

export type DashboardSubscribedSection = {
  id: number;
  retiredAt?: Date | null;
  semesterId: number | null;
};

export type DashboardUserContext = {
  user: DashboardUserSummary & { calendarFeedToken: string | null };
  sectionIds: number[];
  subscribedSections: DashboardSubscribedSection[];
};

export async function getDashboardUserContext(
  userId: string,
): Promise<DashboardUserContext | null> {
  const user = await withUserDbContext(userId, (tx) =>
    tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        calendarFeedToken: true,
        sectionSubscriptions: {
          select: {
            section: {
              select: { id: true, retiredAt: true, semesterId: true },
            },
          },
        },
      },
    }),
  );

  if (!user) return null;

  return {
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      calendarFeedToken: user.calendarFeedToken,
    },
    sectionIds: user.sectionSubscriptions.map((row) => row.section.id),
    subscribedSections: user.sectionSubscriptions.map((row) => row.section),
  };
}
