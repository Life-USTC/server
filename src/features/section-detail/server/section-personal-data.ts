import { prisma, withUserDbContext } from "@/lib/db/prisma";
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
  const { userId } = input;
  const [subscription, homeworkData] = await Promise.all([
    userId
      ? withUserDbContext(userId, (tx) =>
          tx.userSectionSubscription.findUnique({
            where: { userId_sectionId: { userId, sectionId: section.id } },
            select: { kind: true },
          }),
        )
      : null,
    getSectionHomeworkData(section.id, input.userId, input.focusedHomeworkId),
  ]);
  return {
    viewer: {
      signedIn: homeworkData.viewer.isAuthenticated,
      isSubscribed: subscription != null,
      ...(subscription ? { subscriptionKind: subscription.kind } : {}),
    },
    homeworkData,
  };
}
