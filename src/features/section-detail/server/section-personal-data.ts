import { getUserSectionSubscriptionStatusForSection } from "@/features/subscriptions/server/subscriptions";
import { prisma } from "@/lib/db/prisma";
import { getSectionHomeworkData } from "./section-detail-homework-data";

/** Web-only projection. Public HTML must never call this reader. */
export async function getSectionPersonalData(input: {
  jwId: number;
  userId: string | null;
  focusedHomeworkId: string | null;
}) {
  const section = await prisma.section.findUnique({
    where: { jwId: input.jwId },
    select: { id: true },
  });
  if (!section) return null;
  const [subscription, homeworkData] = await Promise.all([
    input.userId
      ? getUserSectionSubscriptionStatusForSection(input.userId, input.jwId)
      : null,
    getSectionHomeworkData(section.id, input.userId, input.focusedHomeworkId),
  ]);
  return {
    viewer: {
      signedIn: homeworkData.viewer.isAuthenticated,
      isSubscribed: subscription?.isSubscribed ?? false,
    },
    homeworkData,
  };
}
