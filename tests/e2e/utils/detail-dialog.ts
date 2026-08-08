import { expect, type Locator, type Page } from "@playwright/test";

const DETAIL_DIALOG_SELECTOR = '[data-slot="dialog-content"]';

export function detailDialog(page: Page) {
  return page.locator(DETAIL_DIALOG_SELECTOR).first();
}

export function detailDialogBody(dialog: Locator) {
  return dialog.locator('[data-slot="detail-dialog-body"]');
}

export function detailDialogAside(dialog: Locator) {
  return dialog.locator('[data-slot="detail-dialog-aside"]');
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
 * Documented homework popup order (`docs/contracts/homework.json`): description,
 * due summary, vertical metadata excluding platform createdAt, action controls,
 * then discussion. The due summary carries the primary properties, so it must
 * come before the metadata rows, and the metadata list must not repeat the due
 * date or expose a creation timestamp.
 */
export async function expectHomeworkDetailOrder(dialog: Locator) {
  const body = detailDialogBody(dialog);

  const dueSummary = body
    .locator('[data-slot="item"]')
    .filter({ hasText: /提交截止|Submission due/i })
    .first();
  await expect(dueSummary).toBeVisible();

  const metadata = body.locator("dl").first();
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

/** Action controls belong in the details column, ahead of the discussion. */
export async function expectDialogActionsInBody(
  dialog: Locator,
  actionName: RegExp,
) {
  const action = detailDialogBody(dialog)
    .getByRole("button", { name: actionName })
    .first();
  await expect(action).toBeVisible();
  return action;
}
