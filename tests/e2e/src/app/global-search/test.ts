import { expect } from "@playwright/test";
import { observeAction } from "../../../utils/observed-action";
import { test as workerTest } from "../../../utils/owned-page";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

// Every search case owns its catalog, including public/anonymous searches.
const test = workerTest.extend<{
  catalog: undefined;
  searchRun: (work: () => Promise<void>) => Promise<void>;
}>({
  searchRun: async ({ pageRun }, use) => {
    await use((work) =>
      pageRun(work, async (_response, request) => {
        throw new Error(
          `Read-only search submitted ${request.method()} ${new URL(request.url()).pathname}`,
        );
      }),
    );
  },
  catalog: [
    async ({ isolatedWorker, run }, use) => {
      await run(() =>
        isolatedWorker.database.owner.course.create({
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
                  create: {
                    jwId: 1,
                    nameCn: "林璟锵",
                    nameEn: "Lin Jingqiang",
                  },
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
        }),
      );
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

test(
  "global search shortcut returns catalog results",
  { tag: "@Search/Web" },
  async ({ searchRun, page }, testInfo) => {
    await searchRun(async () => {
      await gotoAndWaitForReady(page, "/");

      await page.keyboard.press("Control+k");
      const dialog = page.locator('[data-slot="dialog-content"]');
      await expect(dialog).toBeVisible();

      await observeAction(
        () =>
          page.waitForResponse(
            (response) =>
              response.url().includes("/api/search?q=math") &&
              response.url().includes("locale=") &&
              !response.url().includes("scope=workspace") &&
              response.ok(),
          ),
        async () => {
          const input = dialog.getByRole("combobox", { name: /搜索|Search/i });
          await expect(input).toBeVisible();
          await input.pressSequentially("math", { delay: 40 });
        },
      );

      await expect(
        dialog
          .getByRole("option", { name: /Advanced Linear Algebra|MATH2001/ })
          .first(),
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath("global-search-results.png"),
      });
    });
  },
);

test("global search returns Chinese catalog matches", {
  tag: "@Search/Web",
}, async ({ searchRun, page }) => {
  await searchRun(async () => {
    await gotoAndWaitForReady(page, "/");

    await page.keyboard.press("Control+k");
    const dialog = page.locator('[data-slot="dialog-content"]');
    await expect(dialog).toBeVisible();

    await observeAction(
      () =>
        page.waitForResponse(
          (response) =>
            response.url().includes(encodeURIComponent("线性代数")) &&
            response.url().includes("locale=") &&
            !response.url().includes("scope=workspace") &&
            response.ok(),
        ),
      async () => {
        const input = dialog.getByRole("combobox", { name: /搜索|Search/i });
        await expect(input).toBeVisible();
        await input.fill("线性代数");
      },
    );

    await expect(
      dialog
        .getByRole("option", { name: /线性代数进阶|Advanced Linear Algebra/ })
        .first(),
    ).toBeVisible();
  });
});

test("global search still works after interrupted IME composition", {
  tag: "@Search/Web",
}, async ({ searchRun, page }) => {
  await searchRun(async () => {
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

    await observeAction(
      () =>
        page.waitForResponse(
          (response) =>
            response.url().includes(encodeURIComponent("线性代数")) &&
            response.ok(),
        ),
      async () => {
        await input.evaluate((element) => {
          element.dispatchEvent(
            new CompositionEvent("compositionend", { bubbles: true }),
          );
          element.dispatchEvent(
            new InputEvent("input", { bubbles: true, isComposing: false }),
          );
        });
      },
    );

    await expect(
      dialog
        .getByRole("option", { name: /线性代数进阶|Advanced Linear Algebra/ })
        .first(),
    ).toBeVisible();
  });
});

test("global search trigger opens dialog and navigates to a result", {
  tag: "@Search/Web",
}, async ({ searchRun, page }) => {
  await searchRun(async () => {
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
});

test("signed-in global search returns catalog results", {
  tag: "@Search/Web",
}, async ({ searchRun, page, isolatedWorker }) => {
  await searchRun(async () => {
    const actor = await isolatedWorker.createActor();
    await page.context().addCookies([actor.cookie]);
    const session = await page.request.get("/api/auth/get-session");
    expect(session.status()).toBe(200);
    expect((await session.json()).user.id).toBe(actor.id);
    await gotoAndWaitForReady(page, "/workspace/overview");

    const dialog = page.locator('[data-slot="dialog-content"]');
    const response = await observeAction(
      () =>
        page.waitForResponse(
          (response) =>
            response.url().includes("/api/search") &&
            response.url().includes(encodeURIComponent("线性代数")) &&
            response.url().includes("locale=") &&
            response.url().includes("scope=workspace") &&
            response.ok(),
        ),
      async () => {
        await page.keyboard.press("Control+k");
        await expect(dialog).toBeVisible();
        const input = dialog.getByRole("combobox", { name: /搜索|Search/i });
        await expect(input).toBeVisible();
        await input.fill("线性代数");
      },
    );
    expect(response.headers()["cache-control"]).toBe("private, no-store");

    await expect(
      dialog
        .getByRole("option", { name: /线性代数进阶|Advanced Linear Algebra/ })
        .first(),
    ).toBeVisible();
  });
});
