import { cleanupAuditTargetsForE2e } from "./e2e-db/audit";
import { withE2ePrisma } from "./e2e-db/prisma";

function uniqueIds(ids: readonly (string | undefined)[]) {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

export async function cleanupCommentsForE2e(
  ids: readonly (string | undefined)[],
) {
  const commentIds = uniqueIds(ids);
  if (commentIds.length === 0) return;

  await cleanupAuditTargetsForE2e(
    commentIds.map((targetId) => ({ targetId, targetType: "comment" })),
  );
  await withE2ePrisma((prisma) =>
    prisma.comment.deleteMany({ where: { id: { in: commentIds } } }),
  );
  await cleanupAuditTargetsForE2e(
    commentIds.map((targetId) => ({ targetId, targetType: "comment" })),
  );
}
