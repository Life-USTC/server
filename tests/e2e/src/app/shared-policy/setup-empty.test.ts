import { expect } from "@playwright/test";
import { test } from "../../../utils/owned-page";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

test("ui.workspace-filters-and-empty-states-6", async ({
  page,
  pageRun,
  isolatedWorker,
}) => {
  await pageRun(
    async () => {
      const db = isolatedWorker.database.owner;
      for (const [locale, width] of [
        ["en-us", 1280],
        ["zh-cn", 390],
      ] as const) {
        const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
        const user = await db.user.create({
          data: {
            name: `Setup ${suffix}`,
            username: `setup${suffix}`,
            email: `setup-${suffix}@example.test`,
          },
        });
        const { cookie } = await isolatedWorker.createSession(user.id);
        await page.context().clearCookies();
        await page
          .context()
          .addCookies([
            cookie,
            { name: "NEXT_LOCALE", value: locale, url: cookie.url },
          ]);
        await page.setViewportSize({ width, height: 844 });
        for (const branch of ["overview", "homeworks", "exams"]) {
          for (const destination of ["sections", "courses"]) {
            await gotoAndWaitForReady(page, `/workspace/${branch}`);
            const empty = page
              .getByRole("main")
              .locator('[data-slot="empty"]')
              .first();
            await expect(empty).toBeVisible();
            const action = empty.locator(`a[href="/catalog/${destination}"]`);
            await expect(action).toBeVisible();
            await expect(action).toHaveAccessibleName(
              destination === "sections"
                ? /教学班|班级|Sections/i
                : /课程|Courses/i,
            );
            await action.click();
            await expect(page).toHaveURL(
              new RegExp(`/catalog/${destination}$`),
            );
            await expect(page.getByRole("main")).toBeVisible();
            await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          }
        }
        expect(
          await db.userSectionSubscription.count({
            where: { userId: user.id },
          }),
        ).toBe(0);
        await gotoAndWaitForReady(page, "/workspace/todos");
        const main = page.getByRole("main");
        await expect(
          main.locator('[data-slot="empty"]').filter({ visible: true }),
        ).toBeVisible();
        const create = main.getByRole("button", { name: /添加待办|Add Todo/i });
        await expect(create).toBeEnabled();
        await create.click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        const title = `First task ${suffix}`;
        await dialog.getByLabel(/^(标题|Title)$/i).fill(title);
        await dialog
          .getByRole("button", { name: /创建待办|Create Todo/i })
          .click();
        await expect(dialog).toBeHidden();
        await expect(
          main
            .getByRole("button", { name: title, exact: true })
            .filter({ visible: true }),
        ).toBeVisible();
        const todos = await db.todo.findMany({
          where: { userId: user.id },
          select: { title: true, completed: true },
        });
        expect(todos).toEqual([{ title, completed: false }]);
      }
    },
    async (response, request) => {
      expect(request.method()).toBe("POST");
      expect(new URL(request.url()).pathname).toBe("/workspace/todos");
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({
        type: "redirect",
        status: 303,
        location: "/workspace/todos",
      });
    },
  );
});
