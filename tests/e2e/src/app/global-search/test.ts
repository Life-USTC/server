import { expect } from "@playwright/test";
import { test as workerTest } from "../../../utils/isolated-worker";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

// Every search case owns its catalog, including public/anonymous searches.
const test = workerTest.extend<{ catalog: undefined }>({
  catalog: [
    async ({ isolatedWorker }, use) => {
      await isolatedWorker.database.owner.course.create({
        data: {
          jwId: 1,
          code: "MATH2001",
          nameCn: "线性代数进阶",
          nameEn: "Advanced Linear Algebra",
          sections: {
            create: {
              jwId: 2,
              code: "MATH2001.01",
              teachers: {
                create: { jwId: 1, nameCn: "林璟锵", nameEn: "Lin Jingqiang" },
              },
              semester: {
                create: {
                  jwId: 1,
                  code: "2026-autumn",
                  nameCn: "2026年秋季学期",
                  startDate: new Date("2026-08-31T00:00:00Z"),
                  endDate: new Date("2027-01-31T00:00:00Z"),
                },
              },
            },
          },
        },
      });
      await use(undefined);
    },
    { auto: true },
  ],
});

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("global search shortcut returns catalog results", async ({
  page,
}, testInfo) => {
  await gotoAndWaitForReady(page, "/");

  await page.keyboard.press("Control+k");
  const dialog = page.locator('[data-slot="dialog-content"]');
  await expect(dialog).toBeVisible();

  const searchResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/search?q=math") &&
      response.url().includes("locale=") &&
      !response.url().includes("scope=workspace") &&
      response.ok(),
  );

  const input = dialog.getByRole("combobox", { name: /搜索|Search/i });
  await expect(input).toBeVisible();
  await input.pressSequentially("math", { delay: 40 });
  await searchResponse;

  await expect(
    dialog
      .getByRole("option", { name: /Advanced Linear Algebra|MATH2001/ })
      .first(),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("global-search-results.png"),
  });
});

test("global search returns Chinese catalog matches", async ({ page }) => {
  await gotoAndWaitForReady(page, "/");

  await page.keyboard.press("Control+k");
  const dialog = page.locator('[data-slot="dialog-content"]');
  await expect(dialog).toBeVisible();

  const searchResponse = page.waitForResponse(
    (response) =>
      response.url().includes(encodeURIComponent("线性代数")) &&
      response.url().includes("locale=") &&
      !response.url().includes("scope=workspace") &&
      response.ok(),
  );

  const input = dialog.getByRole("combobox", { name: /搜索|Search/i });
  await expect(input).toBeVisible();
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
  await expect(
    dialog.getByRole("combobox", { name: /搜索|Search/i }),
  ).toBeVisible();

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

  const input = dialog.getByRole("combobox", { name: /搜索|Search/i });
  await expect(input).toBeVisible();
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

test("signed-in global search returns catalog results", async ({
  page,
  isolatedWorker,
}) => {
  const actor = await isolatedWorker.createActor();
  await page.context().addCookies([actor.cookie]);
  const session = await page.request.get("/api/auth/get-session");
  expect(session.status()).toBe(200);
  expect((await session.json()).user.id).toBe(actor.id);
  await gotoAndWaitForReady(page, "/workspace/overview");

  const searchResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/search") &&
      response.url().includes(encodeURIComponent("线性代数")) &&
      response.url().includes("locale=") &&
      response.url().includes("scope=workspace") &&
      response.ok(),
  );

  await page.keyboard.press("Control+k");
  const dialog = page.locator('[data-slot="dialog-content"]');
  await expect(dialog).toBeVisible();
  const input = dialog.getByRole("combobox", { name: /搜索|Search/i });
  await expect(input).toBeVisible();
  await input.fill("线性代数");
  const response = await searchResponse;
  expect(response.headers()["cache-control"]).toBe("private, no-store");

  await expect(
    dialog
      .getByRole("option", { name: /线性代数进阶|Advanced Linear Algebra/ })
      .first(),
  ).toBeVisible();
});
