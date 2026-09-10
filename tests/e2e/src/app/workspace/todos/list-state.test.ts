import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`待办筛选、就近排序和删除即时更新 ${viewport.width}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await signInAsDebugUser(page, "/workspace/todos");
    const prefix = `e2e-todo-state-${viewport.width}-${Date.now()}`;
    const ids: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const fixtures = [
      { title: `${prefix}-old`, dueAt: "2026-03-26T20:00:00+08:00" },
      { title: `${prefix}-undated`, dueAt: null },
      { title: `${prefix}-tomorrow`, dueAt: "2026-09-11T12:00:00+08:00" },
      { title: `${prefix}-near`, dueAt: "2026-09-10T13:00:00+08:00" },
    ];
    try {
      for (const fixture of fixtures) {
        const response = await page.request.post("/api/workspace/todos", {
          data: { ...fixture, priority: "medium" },
        });
        expect(response.ok()).toBe(true);
        const body = await response.json();
        ids.push(body.todo.id);
      }
      await gotoAndWaitForReady(
        page,
        "/workspace/todos?snapshotAt=2026-09-10T12%3A00%3A00%2B08%3A00",
      );
      await expect(page).toHaveTitle(/待办|Todos/i);
      const list =
        viewport.width >= 768
          ? page.getByRole("table")
          : page.getByTestId("workspace-todos-cards");
      const titles = list.getByRole("button").filter({ hasText: prefix });
      await expect(titles).toHaveText([
        `${prefix}-near`,
        `${prefix}-tomorrow`,
        `${prefix}-old`,
        `${prefix}-undated`,
      ]);
      const incomplete = page.getByRole("radio", {
        name: /^(未完成|Incomplete)$/i,
      });
      const completed = page.getByRole("radio", {
        name: /^(已完成|Completed)$/i,
      });
      const all = page.getByRole("radio", { name: /^(全部|All)$/i });
      for (const filter of [
        incomplete,
        completed,
        completed,
        all,
        all,
        incomplete,
      ]) {
        await filter.click();
        await expect(filter).toBeChecked();
        await expect(titles).toHaveCount(filter === completed ? 0 : 4);
      }
      await list
        .getByRole("button", { name: `${prefix}-near`, exact: true })
        .click();
      const detail = page.getByRole("dialog", {
        name: `${prefix}-near`,
        exact: true,
      });
      await expect(detail).toBeVisible();
      const completionResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          response.url().includes(`/api/workspace/todos/${ids[3]}`),
      );
      await detail
        .getByRole("button", { name: /标记为完成|Mark as complete/i })
        .click();
      expect((await completionResponse).ok()).toBe(true);
      await expect(detail.getByRole("heading")).toHaveCSS(
        "text-decoration-line",
        "line-through",
      );
      await captureStepScreenshot(
        page,
        testInfo,
        `todo-completed-detail-${viewport.width}`,
      );
      await detail.getByRole("button", { name: "Close", exact: true }).click();
      await expect(titles).toHaveCount(3);
      await completed.click();
      await expect(titles).toHaveText([`${prefix}-near`]);
      await titles.click();
      await detail
        .getByRole("button", { name: /删除待办|Delete todo/i })
        .click();
      const deletedResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "DELETE" &&
          response.url().includes(`/api/workspace/todos/${ids[3]}`),
      );
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: /^(删除|Delete)$/i })
        .click();
      expect((await deletedResponse).ok()).toBe(true);
      await expect(detail).toBeHidden();
      for (const filter of [all, incomplete, completed, all]) {
        await filter.click();
        await expect(filter).toBeChecked();
        await expect(titles).toHaveCount(filter === completed ? 0 : 3);
        await expect(
          list.getByRole("button", { name: `${prefix}-near`, exact: true }),
        ).toHaveCount(0);
      }
      await expect(titles).toHaveText([
        `${prefix}-tomorrow`,
        `${prefix}-old`,
        `${prefix}-undated`,
      ]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
      await captureStepScreenshot(
        page,
        testInfo,
        `todo-filtered-list-${viewport.width}`,
      );
    } finally {
      for (const id of ids)
        await page.request.delete(`/api/workspace/todos/${id}`);
    }
  });
}
