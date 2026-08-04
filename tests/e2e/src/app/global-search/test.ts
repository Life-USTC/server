import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../utils/auth";
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
      .getByRole("option", { name: /Advanced Linear Algebra|MATH2001/ })
      .first(),
  ).toBeVisible();
});

test("global search returns Chinese catalog matches", async ({ page }) => {
  await gotoAndWaitForReady(page, "/");

  await page.keyboard.press("Control+k");
  const dialog = page.locator('[data-slot="dialog-content"]');
  await expect(dialog).toBeVisible();

  const searchResponse = page.waitForResponse(
    (response) =>
      response.url().includes(encodeURIComponent("线性代数")) && response.ok(),
  );

  const input = dialog.locator("input").first();
  await input.fill("线性代数");
  await searchResponse;

  await expect(
    dialog
      .getByRole("option", { name: /线性代数进阶|Advanced Linear Algebra/ })
      .first(),
  ).toBeVisible();
});

test("global search still works after interrupted IME composition", async ({
  page,
}) => {
  await gotoAndWaitForReady(page, "/");

  await page.keyboard.press("Control+k");
  const dialog = page.locator('[data-slot="dialog-content"]');
  const input = dialog.locator("input").first();

  await input.evaluate((element) => {
    element.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
  });
  await input.fill("线性代数");

  const searchResponse = page.waitForResponse(
    (response) =>
      response.url().includes(encodeURIComponent("线性代数")) && response.ok(),
  );
  await input.evaluate((element) => {
    element.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true }),
    );
    element.dispatchEvent(
      new InputEvent("input", { bubbles: true, isComposing: false }),
    );
  });
  await searchResponse;

  await expect(
    dialog
      .getByRole("option", { name: /线性代数进阶|Advanced Linear Algebra/ })
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
      .getByRole("option", { name: /Advanced Linear Algebra|MATH2001/ })
      .first(),
  ).toBeVisible();
  await dialog
    .getByRole("option", { name: /Advanced Linear Algebra · / })
    .first()
    .click();

  await expect(page).toHaveURL(/\/catalog\/(courses|sections)\/\d+/);
  await expect(dialog).toBeHidden();
});

test("signed-in global search returns catalog results", async ({ page }) => {
  await signInAsDebugUser(page, "/workspace/overview");

  const searchResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/search") &&
      response.url().includes(encodeURIComponent("线性代数")) &&
      response.ok(),
  );

  await page.keyboard.press("Control+k");
  const dialog = page.locator('[data-slot="dialog-content"]');
  await expect(dialog).toBeVisible();
  await dialog.locator("input").first().fill("线性代数");
  await searchResponse;

  await expect(
    dialog
      .getByRole("option", { name: /线性代数进阶|Advanced Linear Algebra/ })
      .first(),
  ).toBeVisible();
});
