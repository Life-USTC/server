/**
 * E2E tests for the todos dashboard (`/workspace/todos`)
 *
 * ## Data Represented
 * - Seed todos: DEV_SEED.todos.dueTodayTitle (due today, incomplete) and
 *   DEV_SEED.todos.completedTitle (completed)
 * - Each todo card shows: title, priority badge, due date, hover completion button,
 *   and optional markdown content
 *
 * ## UI/UX Elements
 * - Filter toolbar: incomplete (default) / completed / all
 * - Completion button is available from each todo card
 * - Add button opens a modal form (title, priority, due date, content)
 * - Clicking a todo title opens a detail modal with a delete button
 * - Todo cards display priority badges (high/medium/low)
 *
 * ## Edge Cases
 * - Unauthenticated legacy tab → protected semantic route, then sign-in
 * - Optimistic updates via useOptimistic for toggle/delete/add
 * - Empty state shown when filter yields no matching todos
 */
import { expect, type Page, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { visibleText } from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

async function cleanupTodosByTitlePrefix(page: Page, prefix: string) {
  const response = await page.request.get("/api/workspace/todos");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    todos?: Array<{ id?: string; title?: string }>;
  };
  for (const todo of body.todos ?? []) {
    if (todo.id && todo.title?.startsWith(prefix)) {
      const deleteResponse = await page.request.delete(
        `/api/workspace/todos/${todo.id}`,
      );
      expect(deleteResponse.status()).toBe(200);
    }
  }
}

test.describe("仪表盘待办", () => {
  test("未登录旧 todos tab 重定向到语义路径", async ({ page }) => {
    const response = await page.request.get("/?tab=todos&todoView=list", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe("/workspace/todos?todoView=list");
  });

  test("登录后显示种子待办", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/todos");

    await expect(page.locator("#main-content")).toBeVisible();
    await expect(visibleText(page, DEV_SEED.todos.dueTodayTitle)).toBeVisible();
    await expect(visibleText(page, DEV_SEED.todos.overdueTitle)).toBeVisible();
    await expect(page.getByRole("switch")).toHaveCount(0);

    const row = page
      .getByRole("row")
      .filter({ hasText: DEV_SEED.todos.dueTodayTitle })
      .first();
    await expect(row).toBeVisible();
    const completionButton = row
      .getByRole("button", { name: /标记为完成|Mark as complete/i })
      .first();
    await expect(completionButton).toBeVisible();
    await expect(completionButton).toBeEnabled();

    const detailButton = row.getByRole("button", {
      name: DEV_SEED.todos.dueTodayTitle,
      exact: true,
    });
    await detailButton.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("dialog", { name: DEV_SEED.todos.dueTodayTitle }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await captureStepScreenshot(page, testInfo, "dashboard-todos-seed");
  });

  test("移动端待办工具栏保留筛选和大尺寸主操作", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.removeItem("life-ustc-dashboard-view-mode");
    });
    await page.setViewportSize({ height: 844, width: 390 });
    await signInAsDebugUser(page, "/workspace/todos");

    const incomplete = page
      .getByRole("radio", { name: /未完成|Incomplete/i })
      .first();
    const add = page.getByTestId("dashboard-todos-add");
    await expect(incomplete).toBeVisible();
    await expect(add).toBeVisible();
    await expect(page.getByTestId("dashboard-todos-view-menu")).toHaveCount(0);

    for (const control of [incomplete, add]) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }

    const all = page.getByRole("radio", { name: /全部|All/i }).first();
    await all.click();
    await expect(all).toHaveAttribute("aria-checked", "true");

    await gotoAndWaitForReady(page, "/workspace/todos?todoView=list");
    await expect(page.getByTestId("dashboard-todos-cards")).toBeVisible();
    await expect(page.getByRole("table")).toBeHidden();
    const todoItem = page
      .getByTestId("dashboard-todos-cards")
      .locator('[data-slot="item"]')
      .first();
    await expect(todoItem).toBeVisible();
    await expect(todoItem.locator('[data-slot="item-content"]')).toBeVisible();
    await expect(todoItem.locator('[data-slot="item-actions"]')).toBeVisible();
    for (const control of await todoItem
      .locator('[data-slot="item-actions"]')
      .getByRole("button")
      .all()) {
      const box = await control.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    await captureStepScreenshot(page, testInfo, "todos/mobile-toolbar");
  });

  test("可切换待办完成状态并更新筛选", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/todos");

    const row = page
      .getByRole("row")
      .filter({ hasText: DEV_SEED.todos.dueTodayTitle })
      .first();
    await expect(row).toBeVisible();

    const completeButton = row
      .getByRole("button", { name: /标记为完成|Mark as complete/i })
      .first();
    await expect(completeButton).toBeVisible();
    await completeButton.click();

    // Optimistic update removes it from the default incomplete filter
    await expect(visibleText(page, DEV_SEED.todos.dueTodayTitle)).toHaveCount(
      0,
      { timeout: 5_000 },
    );

    // It now appears under the completed filter
    const completedFilter = page
      .getByRole("radio", { name: /已完成|Completed/i })
      .first();
    await completedFilter.click();
    await expect(visibleText(page, DEV_SEED.todos.dueTodayTitle)).toBeVisible({
      timeout: 5_000,
    });

    // Toggle back to restore seed state
    const completedRow = page
      .getByRole("row")
      .filter({ hasText: DEV_SEED.todos.dueTodayTitle })
      .first();
    const incompleteButton = completedRow
      .getByRole("button", { name: /取消完成|Mark as incomplete/i })
      .first();
    await incompleteButton.click();

    await expect(visibleText(page, DEV_SEED.todos.dueTodayTitle)).toHaveCount(
      0,
      { timeout: 5_000 },
    );

    await captureStepScreenshot(page, testInfo, "dashboard-todos-toggle");
  });

  test("已完成筛选显示已完成的待办", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/todos");

    const completedFilter = page
      .getByRole("radio", { name: /已完成|Completed/i })
      .first();
    const completedTodo = visibleText(page, DEV_SEED.todos.completedTitle);
    await expect(async () => {
      await completedFilter.click();
      await expect(completedTodo).toBeVisible({ timeout: 3_000 });
    }).toPass({
      timeout: 15_000,
      intervals: [250, 500, 1_000],
    });

    await captureStepScreenshot(page, testInfo, "dashboard-todos-completed");
  });

  test("嵌套待办路由渲染服务端操作错误", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/todos");

    const postResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/workspace/todos?/createTodo"),
    );
    await page.evaluate(() => {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/workspace/todos?/createTodo";
      document.body.append(form);
      form.requestSubmit();
    });

    await expect((await postResponse).status()).toBe(400);
    await expect(
      visibleText(page, /请输入标题|Please enter a title/i),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "dashboard-todos-action-error");
  });

  test("可以创建、编辑和删除待办", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await signInAsDebugUser(page, "/workspace/todos");

    const title = `e2e-dashboard-todo-${Date.now()}`;
    const editedTitle = `${title}-edited`;

    try {
      // Create a new todo via modal form
      const addTodoButton = page
        .getByRole("button", { name: /添加待办|Add Todo/i })
        .first();
      await expect(addTodoButton).toBeVisible();
      await expect(addTodoButton).toBeEnabled();
      const titleInput = page.getByLabel(/标题|Title/i);
      await expect(async () => {
        await addTodoButton.click();
        await expect(titleInput).toBeVisible({ timeout: 3_000 });
      }).toPass({
        timeout: 10_000,
        intervals: [250, 500, 1_000],
      });
      await titleInput.fill(title);
      await page
        .getByRole("button", { name: /创建待办|Create Todo/i })
        .first()
        .click();

      await expect(visibleText(page, title)).toBeVisible({
        timeout: 15_000,
      });
      await captureStepScreenshot(page, testInfo, "dashboard-todos-created");

      // Edit the temporary todo via its detail modal.
      await visibleText(page, title).click();
      const detailDialog = page.getByRole("dialog", { name: title });
      await expect(detailDialog).toBeVisible();
      const detailText = await detailDialog.innerText();
      const localizedPriorityMatches =
        detailText.match(/\b(?:Low|Medium|High)\b|[低中高]/g) ?? [];
      expect(localizedPriorityMatches).toHaveLength(1);
      expect(detailText).not.toMatch(/\b(?:low|medium|high)\b/);
      const editButton = detailDialog.getByRole("button", {
        name: /编辑待办|Edit Todo/i,
      });
      await expect(editButton).toBeVisible();
      await expect(editButton).toBeEnabled();
      await editButton.click();

      const editDialog = page.getByRole("dialog", {
        name: /编辑待办|Edit Todo/i,
      });
      await expect(editDialog).toBeVisible();
      const editTitleInput = editDialog.getByLabel(/^(标题|Title)$/i);
      await expect(editTitleInput).toHaveValue(title);
      await editTitleInput.fill(editedTitle);
      const updateResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes("/workspace/todos?/updateTodo"),
      );
      const saveButton = editDialog.getByRole("button", {
        name: /保存修改|Save Changes/i,
      });
      await expect(saveButton).toBeEnabled();
      await saveButton.click();
      await expect((await updateResponse).status()).toBe(200);
      await expect(editDialog).toBeHidden();
      await expect(visibleText(page, editedTitle)).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        page.getByRole("button", { name: title, exact: true }),
      ).toHaveCount(0);
      await captureStepScreenshot(page, testInfo, "dashboard-todos-edited");

      await page
        .getByRole("button", { name: editedTitle, exact: true })
        .click();
      const editedDetailDialog = page.getByRole("dialog", {
        name: editedTitle,
      });
      const detailTitle = editedDetailDialog.locator(
        '[data-slot="dialog-title"]',
      );
      await expect(detailTitle).toHaveText(editedTitle);
      const deleteButton = page
        .getByRole("button", { name: /删除待办|Delete todo/i })
        .first();
      await deleteButton.click();
      const confirmDialog = page.getByRole("alertdialog");
      await expect(confirmDialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(confirmDialog).toBeHidden();
      await expect(detailTitle).toBeVisible();

      await deleteButton.click();
      await expect(confirmDialog).toBeVisible();
      await expect(
        confirmDialog.getByRole("button", { name: /取消|Cancel/i }),
      ).toBeEnabled();
      await confirmDialog.getByRole("button", { name: /取消|Cancel/i }).click();
      await expect(confirmDialog).toBeHidden();
      await expect(detailTitle).toBeVisible();

      await deleteButton.click();
      const reopenedConfirmDialog = page.getByRole("alertdialog");
      await expect(reopenedConfirmDialog).toBeVisible();
      const deleteResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "DELETE" &&
          response.url().includes("/api/workspace/todos/"),
      );
      await reopenedConfirmDialog
        .getByRole("button", { name: /删除|Delete/i })
        .click();
      await expect((await deleteResponse).status()).toBe(200);

      await expect(page.getByText(editedTitle)).toHaveCount(0, {
        timeout: 15_000,
      });
      await captureStepScreenshot(page, testInfo, "dashboard-todos-deleted");
    } finally {
      await cleanupTodosByTitlePrefix(page, title);
    }
  });

  test("移动端长标题和内容保持操作可达并按层级排列", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 320, height: 568 });
    await signInAsDebugUser(page, "/workspace/todos");

    const titlePrefix = `e2e-dashboard-todo-mobile-${Date.now()}`;
    const title = `${titlePrefix}-${"长标题".repeat(35)}`;
    const content = `${"这是用于验证待办详情滚动区域的长内容。 ".repeat(24)}\n\nmobile-content-marker`;

    try {
      const addTodoButton = page.getByTestId("dashboard-todos-add");
      await addTodoButton.click();
      const createDialog = page.getByRole("dialog", {
        name: /新建待办|New Todo/i,
      });
      await expect(createDialog).toBeVisible();
      const viewportHeight = page.viewportSize()?.height ?? 568;
      const createBox = await createDialog.boundingBox();
      const createFooter = createDialog.locator('[data-slot="dialog-footer"]');
      expect(createBox).not.toBeNull();
      if (!createBox) throw new Error("Expected the mobile todo dialog bounds");
      expect(createBox.y).toBeGreaterThanOrEqual(16);
      expect(createBox.y + createBox.height).toBeLessThanOrEqual(
        viewportHeight - 16,
      );
      await expect(createFooter).toBeInViewport();

      await createDialog.getByLabel(/^(标题|Title)$/i).fill(title);
      await createDialog
        .getByRole("textbox", { name: /内容描述|Description/i })
        .fill(content);
      await createDialog
        .getByRole("button", { name: /创建待办|Create Todo/i })
        .click();
      await expect(visibleText(page, title)).toBeVisible({ timeout: 15_000 });

      await page.getByRole("button", { name: title, exact: true }).click();
      const detailDialog = page.getByRole("dialog", { name: title });
      await expect(detailDialog).toBeVisible();
      await expect(
        detailDialog.getByText("mobile-content-marker"),
      ).toBeVisible();
      const closeButton = detailDialog.locator('[data-slot="dialog-close"]');
      await expect(closeButton).toBeVisible();
      await expect(closeButton).toBeInViewport();
      const closeBox = await closeButton.boundingBox();
      expect(closeBox).not.toBeNull();
      expect(closeBox?.width ?? 0).toBeGreaterThanOrEqual(24);

      const detailFooter = detailDialog.locator('[data-slot="dialog-footer"]');
      await expect(detailFooter).toBeInViewport();
      const completion = detailFooter.getByRole("button", {
        name: /标记为完成|Mark as complete/i,
      });
      const edit = detailFooter.getByRole("button", {
        name: /编辑待办|Edit Todo/i,
      });
      const deleteButton = detailFooter.getByRole("button", {
        name: /删除待办|Delete todo/i,
      });
      for (const control of [completion, edit, deleteButton]) {
        await expect(control).toBeVisible();
        const box = await control.boundingBox();
        expect(box).not.toBeNull();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(240);
      }
      const [completionBox, editBox, deleteBox] = await Promise.all([
        completion.boundingBox(),
        edit.boundingBox(),
        deleteButton.boundingBox(),
      ]);
      expect(completionBox?.y).toBeLessThan(
        editBox?.y ?? Number.POSITIVE_INFINITY,
      );
      expect(editBox?.y).toBeLessThan(deleteBox?.y ?? Number.POSITIVE_INFINITY);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);

      await closeButton.click();
      await expect(detailDialog).toHaveCount(0);
      await page.getByRole("button", { name: title, exact: true }).click();
      await expect(detailDialog).toBeVisible();

      await deleteButton.click();
      const confirmDialog = page.getByRole("alertdialog");
      await expect(confirmDialog).toBeVisible();
      await expect(confirmDialog).toContainText(title);
      await page.keyboard.press("Escape");
      await expect(confirmDialog).toBeHidden();
      await expect(detailDialog).toBeVisible();

      await deleteButton.click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: /取消|Cancel/i })
        .click();
      await expect(page.getByRole("alertdialog")).toBeHidden();
      await expect(detailDialog).toBeVisible();

      await deleteButton.click();
      const deleteResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "DELETE" &&
          response.url().includes("/api/workspace/todos/"),
      );
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: /删除|Delete/i })
        .click();
      await expect((await deleteResponse).status()).toBe(200);
      await expect(page.getByText(title, { exact: true })).toHaveCount(0, {
        timeout: 15_000,
      });
    } finally {
      await cleanupTodosByTitlePrefix(page, titlePrefix);
    }
  });
});
