import { prisma as basePrisma } from "@/lib/db/prisma";

export type DashboardUserSummary = {
  id: string;
  name: string | null;
  username: string | null;
};

export type DashboardSubscribedSection = {
  id: number;
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
  const user = await basePrisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      calendarFeedToken: true,
      subscribedSections: {
        select: { id: true, semesterId: true },
      },
    },
  });

  if (!user) return null;

  return {
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      calendarFeedToken: user.calendarFeedToken,
    },
    sectionIds: user.subscribedSections.map((section) => section.id),
    subscribedSections: user.subscribedSections,
  };
}
