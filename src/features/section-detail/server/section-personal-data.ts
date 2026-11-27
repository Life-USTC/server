import { getViewerContext } from "@/lib/auth/viewer-context";
import { prisma, withUserDbContext } from "@/lib/db/prisma";
import { runCloudflareTraceSpan } from "@/lib/ports/runtime";
import { getSectionHomeworkData } from "./section-detail-homework-data";

/** Web-only projection. Public HTML must never call this reader. */
export async function getSectionPersonalData(input: {
  jwId: number;
  userId: string | null;
  focusedHomeworkId: string | null;
}) {
  const section =
    !input.userId && !input.focusedHomeworkId
      ? (
          await prisma.$queryRaw<{ id: number; hasHomeworks: boolean }[]>`
        SELECT s.id, EXISTS (
          SELECT 1 FROM "Homework" h
          WHERE h."sectionId" = s.id AND h."deletedAt" IS NULL
        ) AS "hasHomeworks"
        FROM "Section" s WHERE s."jwId" = ${input.jwId}
      `
        )[0]
      : await prisma.section.findUnique({
          where: { jwId: input.jwId },
          select: { id: true },
        });
  if (!section) return null;
  if ("hasHomeworks" in section && section.hasHomeworks === false) {
    return {
      viewer: { signedIn: false, isSubscribed: false },
      homeworkData: {
        viewer: await getViewerContext({ userId: null, includeAdmin: true }),
        homeworks: [],
        auditLogs: [],
      },
    };
  }
  const { userId } = input;
  const [subscription, homeworkData] = await Promise.all([
    userId
      ? runCloudflareTraceSpan("catalog.section.viewer.subscription", {}, () =>
          withUserDbContext(userId, (tx) =>
            tx.userSectionSubscription.findUnique({
              where: { userId_sectionId: { userId, sectionId: section.id } },
              select: { kind: true },
            }),
          ),
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
