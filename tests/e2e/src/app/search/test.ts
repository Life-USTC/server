import { expect, test } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { assertPageContract } from "../_shared/page-contract";

test("search page returns catalog and link results", async ({ page }) => {
  const searchResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/search") &&
      response.url().includes("email") &&
      response.url().includes("locale=") &&
      response.ok(),
  );

  await gotoAndWaitForReady(page, "/search?q=email");

  await expect(
    page.getByRole("heading", { name: /搜索|Search/ }),
  ).toBeVisible();

  const response = await searchResponse;
  const body = (await response.json()) as {
    groups: Array<{ type: string; items: unknown[] }>;
  };
  expect(body.groups.some((group) => group.type === "links")).toBe(true);

  await expect(
    page.getByRole("option", { name: /邮箱|USTC Email/i }).first(),
  ).toBeVisible();
});

test("search page supports keyboard navigation into results", async ({
  page,
}) => {
  await gotoAndWaitForReady(page, "/search?q=线性代数");

  const input = page.getByRole("combobox");
  await expect(input).toBeVisible();
  await expect(page.getByRole("option").first()).toBeVisible();
  await input.press("ArrowDown");

  await expect(page.getByRole("option").first()).toBeFocused();
});

test("search page matches course and teacher terms in one section", async ({
  page,
}) => {
  const query = "线性代数 林璟锵";
  const runtimeErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await gotoAndWaitForReady(page, "/search");

  const searchResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/search") &&
      new URL(response.url()).searchParams.get("q") === query &&
      response.ok(),
  );
  await page.getByRole("combobox").fill(query);
  await searchResponse;

  await expect(page).toHaveURL(/\/search\?q=/);
  await expect(page).toHaveTitle(/^(搜索|Search) - Life@USTC$/);
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await expect(
    page
      .getByRole("option", {
        name: /线性代数进阶.*林璟锵|Advanced Linear Algebra.*Lin Jingqiang/i,
      })
      .first(),
  ).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/search", testInfo });
});
