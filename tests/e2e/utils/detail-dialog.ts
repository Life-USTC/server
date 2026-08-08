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

export function detailDialogFooter(dialog: Locator) {
  return dialog.locator('[data-slot="dialog-footer"]');
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

/** Publish → submission window cells rendered by `HomeworkDetailMetaGrid`. */
export async function expectHomeworkTimelineCells(dialog: Locator) {
  const body = detailDialogBody(dialog);
  await expect(body.getByText(/发布日期|Published/i).first()).toBeVisible();
  await expect(
    body.getByText(/提交开始|Submission opens/i).first(),
  ).toBeVisible();
  await expect(
    body.getByText(/提交截止|Submission due/i).first(),
  ).toBeVisible();
}
