import { expect } from "@playwright/test";
import { observeAction } from "../../../utils/observed-action";
import { test as workerTest } from "../../../utils/owned-page";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { assertPageContract } from "../_shared/page-contract";

// The public search page needs its own catalog even without an account.
const test = workerTest.extend<{
  searchRun: (work: () => Promise<void>) => Promise<void>;
}>({
  searchRun: async ({ pageRun, isolatedWorker }, use) => {
    await use((work) =>
      pageRun(
        async () => {
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
          });
          await work();
        },
        async (_response, request) => {
          throw new Error(
            `Read-only search submitted ${request.method()} ${new URL(request.url()).pathname}`,
          );
        },
      ),
    );
  },
});

test("search page returns catalog and link results", async ({
  page,
  searchRun,
}) => {
  await searchRun(async () => {
    const response = await observeAction(
      () =>
        page.waitForResponse(
          (response) =>
            response.url().includes("/api/search") &&
            response.url().includes("email") &&
            response.url().includes("locale=") &&
            response.ok(),
        ),
      async () => {
        await gotoAndWaitForReady(page, "/search?q=email");

        await expect(
          page.getByRole("heading", { name: /搜索|Search/ }),
        ).toBeVisible();
      },
    );
    const body = (await response.json()) as {
      groups: Array<{ type: string; items: unknown[] }>;
    };
    expect(body.groups.some((group) => group.type === "links")).toBe(true);

    await expect(
      page.getByRole("option", { name: /邮箱|USTC Email/i }).first(),
    ).toBeVisible();
  });
});

test("search page supports keyboard navigation into results", async ({
  page,
  searchRun,
}) => {
  await searchRun(async () => {
    await gotoAndWaitForReady(page, "/search?q=线性代数");

    const input = page.getByRole("combobox", { name: /搜索|Search/i });
    await expect(input).toBeVisible();
    await expect(page.getByRole("option").first()).toBeVisible();
    await input.press("ArrowDown");

    await expect(page.getByRole("option").first()).toBeFocused();
  });
});

test("search page matches course and teacher terms in one section", async ({
  page,
  searchRun,
}) => {
  await searchRun(async () => {
    const query = "线性代数 林璟锵";
    const runtimeErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await gotoAndWaitForReady(page, "/search");

    await observeAction(
      () =>
        page.waitForResponse(
          (response) =>
            response.url().includes("/api/search") &&
            new URL(response.url()).searchParams.get("q") === query &&
            response.ok(),
        ),
      () => page.getByRole("combobox").fill(query),
    );

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
});

test("页面契约", async ({ page, searchRun }, testInfo) => {
  await searchRun(async () => {
    await assertPageContract(page, { routePath: "/search", testInfo });
  });
});
