import { cleanupAuditTargetsForE2e } from "./e2e-db/audit";
import { withE2ePrisma } from "./e2e-db/prisma";

function uniqueIds(ids: readonly (string | undefined)[]) {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

export async function cleanupHomeworksForE2e(
  ids: readonly (string | undefined)[],
) {
  const homeworkIds = uniqueIds(ids);
  if (homeworkIds.length === 0) return;

  const auditTargets = await withE2ePrisma(async (prisma) => {
    const homeworks = await prisma.homework.findMany({
      where: { id: { in: homeworkIds } },
      select: {
        comments: { select: { id: true } },
        description: { select: { id: true } },
        id: true,
      },
    });

    return homeworks.flatMap((homework) => [
      ...homework.comments.map((comment) => ({
        targetId: comment.id,
        targetType: "comment",
      })),
      ...(homework.description
        ? [
            {
              targetId: homework.description.id,
              targetType: "description",
            },
          ]
        : []),
    ]);
  });

  if (auditTargets.length > 0) {
    await cleanupAuditTargetsForE2e(auditTargets);
  }
  await withE2ePrisma((prisma) =>
    prisma.$transaction([
      prisma.homeworkAuditLog.deleteMany({
        where: { homeworkId: { in: homeworkIds } },
      }),
      prisma.homework.deleteMany({ where: { id: { in: homeworkIds } } }),
    ]),
  );
  if (auditTargets.length > 0) {
    await cleanupAuditTargetsForE2e(auditTargets);
  }
}
