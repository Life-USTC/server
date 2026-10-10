import { expect, type Locator, type Page } from "@playwright/test";

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
