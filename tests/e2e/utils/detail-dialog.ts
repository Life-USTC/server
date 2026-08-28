import { expect, type Locator, type Page } from "@playwright/test";

const DETAIL_DIALOG_SELECTOR = '[data-slot="dialog-content"]';

export function detailDialog(page: Page) {
  return page.locator(DETAIL_DIALOG_SELECTOR).first();
}

/**
 * The shared dialog shell names its close control with `aria-label` only, so a
 * visible "Close" string next to the icon is a regression.
 */
export async function expectIconOnlyCloseButton(dialog: Locator) {
  const close = dialog.getByRole("button", { name: /^(Close|关闭)$/i }).first();
  await expect(close).toBeVisible();
  expect((await close.innerText()).trim()).toBe("");
  return close;
}

export async function closeDetailDialog(page: Page, dialog: Locator) {
  const close = await expectIconOnlyCloseButton(dialog);
  await close.click();
  await expect(page.locator(DETAIL_DIALOG_SELECTOR)).toHaveCount(0, {
    timeout: 5_000,
  });
}

export async function expectDetailDialogFitsViewport(
  page: Page,
  dialog: Locator,
) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  const viewport = page.viewportSize();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  if (!box || !viewport) return;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.height).toBeLessThanOrEqual(viewport.height);
}

/**
 * Homework popup (`docs/contracts/homework.json`): due datetime is primary,
 * relative urgency is secondary, and remaining facts are a table. The table
 * must not repeat the due date or expose a creation timestamp.
 */
export async function expectHomeworkDetailOrder(dialog: Locator) {
  const dueSummary = dialog
    .locator('[data-testid="homework-deadline-summary"]')
    .first();
  await expect(dueSummary).toBeVisible();

  const metadata = dialog
    .locator('[data-testid="homework-secondary-details"]')
    .locator("table")
    .first();
  await expect(metadata).toBeVisible();
  await expect(metadata.getByText(/发布日期|Published/i)).toBeVisible();
  await expect(metadata.getByText(/提交开始|Submission opens/i)).toBeVisible();
  await expect(metadata.getByText(/提交截止|Submission due/i)).toHaveCount(0);
  await expect(metadata.getByText(/创建于|Created/i)).toHaveCount(0);

  const dueBox = await dueSummary.boundingBox();
  const metadataBox = await metadata.boundingBox();
  expect(dueBox).not.toBeNull();
  expect(metadataBox).not.toBeNull();
  if (dueBox && metadataBox) {
    expect(dueBox.y).toBeLessThan(metadataBox.y);
  }
}

/**
 * Discussion is the next block in the same reading column, not a right-hand
 * rail. Side rails belong on pages (`docs/contracts/_ui.json`).
 */
export async function expectSingleColumnDiscussion(dialog: Locator) {
  const dueSummary = dialog
    .locator('[data-testid="homework-deadline-summary"]')
    .first();
  const discussion = dialog.locator('[data-testid="homework-discussion"]');
  await expect(
    discussion.getByRole("heading", { name: /作业讨论|Homework discussion/i }),
  ).toBeVisible();

  const dueBox = await dueSummary.boundingBox();
  const discussionBox = await discussion.boundingBox();
  expect(dueBox).not.toBeNull();
  expect(discussionBox).not.toBeNull();
  if (!dueBox || !discussionBox) return;

  expect(discussionBox.y).toBeGreaterThan(dueBox.y);
  expect(Math.abs(discussionBox.x - dueBox.x)).toBeLessThan(24);
}

/** Overlays stay at a reading width; they must not become a two-column page. */
export async function expectComfortablePopupWidth(page: Page, dialog: Locator) {
  const viewport = page.viewportSize();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  if (!box || !viewport) return;
  if (viewport.width >= 1024) {
    // Shared homework shell uses `sm:max-w-3xl` (48rem), not a page overlay.
    expect(box.width).toBeLessThanOrEqual(800);
    expect(box.width).toBeLessThan(viewport.width * 0.7);
  }
}

/** Primary actions live in the dialog, including the pinned footer. */
export async function expectDialogAction(dialog: Locator, actionName: RegExp) {
  const action = dialog.getByRole("button", { name: actionName }).first();
  await expect(action).toBeVisible();
  return action;
}
