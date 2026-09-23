/**
 * Shared helpers for /catalog/sections/[jwId] E2E shards.
 */
import { expect, type Locator, type Page } from "@playwright/test";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";

export const SECTION_URL = `/catalog/sections/${DEV_SEED.section.jwId}`;

export function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function jumpToSection(
  page: Page,
  name: RegExp,
  selector: string,
) {
  const hash = selector.replace(/^#/, "");
  if (
    hash === "calendar" ||
    hash === "homework" ||
    hash === "comments" ||
    hash === "teachers"
  ) {
    await gotoAndWaitForReady(page, `${SECTION_URL}#${hash}`);
    await expect(page.locator(selector)).toBeVisible({ timeout: 60_000 });
    if (hash === "calendar") {
      await expect(
        page
          .locator("#calendar")
          .getByRole("heading", { name: /日历|Calendar/i })
          .or(page.locator("#calendar table"))
          .first(),
      ).toBeVisible({ timeout: 60_000 });
    }
    return;
  }

  const heading = page.getByRole("heading", { name }).first();
  await expect(heading).toBeVisible();
  await heading.scrollIntoViewIfNeeded();
  await expect(page.locator(selector)).toBeVisible({ timeout: 60_000 });
}

export function getDetailViewport(page: Page) {
  return page.locator("[data-detail-scroll-container]").first();
}

export async function openCommentDeleteDialog(
  page: Page,
  commentCard: Locator,
) {
  await commentCard.scrollIntoViewIfNeeded();
  await commentCard.hover();
  const moreActions = commentCard
    .getByRole("button", { name: /更多操作|More actions/i })
    .first();
  await expect(moreActions).toBeVisible();
  await moreActions.click();

  const actionMenu = page.getByRole("menu").last();
  const deleteItem = actionMenu.getByRole("menuitem", {
    name: /删除|Delete/i,
  });
  await expect(deleteItem).toBeVisible();
  await deleteItem.click();

  const deleteDialog = page.getByRole("alertdialog", {
    name: /删除评论|Delete Comment/i,
  });
  await expect(deleteDialog).toBeVisible();
  return deleteDialog;
}

export async function selectHomeworkAction(
  page: Page,
  detailDialog: Locator,
  actionName: RegExp,
) {
  const moreActions = detailDialog
    .locator('[data-slot="dialog-footer"]')
    .getByRole("button", { name: /更多信息|More details/i });
  await expect(moreActions).toBeVisible();
  await moreActions.click();

  const action = page.getByRole("menu").last().getByRole("menuitem", {
    name: actionName,
  });
  await expect(action).toBeVisible();
  await action.click();
}
