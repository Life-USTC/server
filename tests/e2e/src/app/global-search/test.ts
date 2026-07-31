import { expect, test } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

test("global search shortcut returns catalog results", async ({ page }) => {
  await gotoAndWaitForReady(page, "/");

  await page.keyboard.press("Control+k");
  const dialog = page.locator('[data-slot="dialog-content"]');
  await expect(dialog).toBeVisible();

  const searchResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/search?q=math") && response.ok(),
  );

  const input = dialog.locator("input").first();
  await input.pressSequentially("math", { delay: 40 });
  await searchResponse;

  await expect(
    dialog
      .getByRole("button", { name: /Advanced Linear Algebra|MATH2001/ })
      .first(),
  ).toBeVisible();
});

test("global search trigger opens dialog and navigates to a result", async ({
  page,
}) => {
  await gotoAndWaitForReady(page, "/");

  await page
    .getByRole("button", { name: /打开搜索|Open search/i })
    .first()
    .click();
  const dialog = page.locator('[data-slot="dialog-content"]');
  await expect(dialog).toBeVisible();

  const input = dialog.locator("input").first();
  await input.fill("MATH2001");

  await expect(
    dialog
      .getByRole("button", { name: /Advanced Linear Algebra|MATH2001/ })
      .first(),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: /Advanced Linear Algebra · MATH2001\.01/ })
    .click();

  await expect(page).toHaveURL(/\/catalog\/(courses|sections)\/\d+/);
  await expect(dialog).toBeHidden();
});
