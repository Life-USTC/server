import { expect, type Locator, type Page } from "@playwright/test";
import { cleanupAuditTargetsForE2e } from "./e2e-db/audit";
import { withE2ePrisma } from "./e2e-db/prisma";

function uniqueIds(ids: readonly (string | undefined)[]) {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

/** Opens the collapsed comment composer when needed and returns the body editor. */
export async function openCommentComposer(
  page: Page,
  root: Locator = page.locator("#comments"),
) {
  const composer = root
    .getByRole("textbox", { name: /评论内容|Comment body/i })
    .first();
  if (await composer.isVisible().catch(() => false)) {
    return composer;
  }

  await root.getByRole("button", { name: /发布评论|Post comment/i }).click();
  await expect(composer).toBeVisible({ timeout: 15_000 });
  return composer;
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
