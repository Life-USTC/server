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

test("页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/search", testInfo });
});
