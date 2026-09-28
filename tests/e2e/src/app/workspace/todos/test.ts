import { expect } from "@playwright/test";
import {
  closeDetailDialog,
  detailDialog,
  expectDialogAction,
} from "../../../../utils/detail-dialog";
import { visibleText } from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { test } from "../../../../utils/todo-fixture";

test.describe.configure({ mode: "parallel" });

test.describe("仪表盘待办", () => {
  test("未登录旧 todos tab 重定向到语义路径", async ({ page }) => {
    const response = await page.request.get("/?tab=todos&todoView=list", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe("/workspace/todos?todoView=list");
  });

  test("登录后显示独立准备的待办", async ({ page, todos }, testInfo) => {
    await gotoAndWaitForReady(page, "/workspace/todos");

    await expect(page.locator("#main-content")).toBeVisible();
    await expect(visibleText(page, todos.pending.title)).toBeVisible();
    await expect(visibleText(page, todos.overdue.title)).toBeVisible();
    await expect(page.getByRole("switch")).toHaveCount(0);

    const row = page
      .getByRole("row")
      .filter({ hasText: todos.pending.title })
      .first();
    await expect(row).toBeVisible();
    const completionButton = row
      .getByRole("button", { name: /标记为完成|Mark as complete/i })
      .first();
    await expect(completionButton).toBeVisible();
    await expect(completionButton).toBeEnabled();

    const detailButton = row.getByRole("button", {
      name: todos.pending.title,
      exact: true,
    });
    await detailButton.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("dialog", { name: todos.pending.title }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await captureStepScreenshot(page, testInfo, "workspace-todos-seed");
  });

  test("todo.web-create-target", async ({ page, todos: _todos }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.removeItem("life-ustc-workspace-view-mode");
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(page, "/workspace/todos");

    const incomplete = page
      .getByRole("radio", { name: /未完成|Incomplete/i })
      .first();
    const add = page.getByTestId("workspace-todos-add");
    await expect(incomplete).toBeVisible();
    await expect(add).toBeVisible();
    await expect(page.getByTestId("workspace-todos-view-menu")).toHaveCount(0);

    const addBox = await add.boundingBox();
    expect(addBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(addBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    const filterBox = await incomplete.boundingBox();
    expect(filterBox?.height).toBeGreaterThanOrEqual(44);
    expect(filterBox?.width).toBeGreaterThanOrEqual(44);

    const all = page.getByRole("radio", { name: /全部|All/i }).first();
    await all.click();
    await expect(all).toHaveAttribute("aria-checked", "true");

    await gotoAndWaitForReady(page, "/workspace/todos?todoView=list");
    await expect(page.getByTestId("workspace-todos-cards")).toBeVisible();
    await expect(page.getByRole("table")).toBeHidden();
    const todoItem = page
      .getByTestId("workspace-todos-cards")
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

  for (const completed of [false, true]) {
    test(`切换待办到${completed ? "未完成" : "已完成"}并更新筛选`, async ({
      page,
      todoState,
    }, testInfo) => {
      const [todo] = await todoState.seed([
        { title: "Independent completion toggle", completed },
      ]);
      await gotoAndWaitForReady(page, "/workspace/todos");
      const initial = page.getByRole("radio", {
        name: completed ? /^(已完成|Completed)$/i : /^(未完成|Incomplete)$/i,
      });
      const destination = page.getByRole("radio", {
        name: completed ? /^(未完成|Incomplete)$/i : /^(已完成|Completed)$/i,
      });
      await initial.click();
      const row = page.getByRole("row").filter({ hasText: todo.title });
      await expect(row).toBeVisible();
      const changed = page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          response.url().includes(`/api/workspace/todos/${todo.id}`),
      );
      await row
        .getByRole("button", {
          name: completed
            ? /取消完成|Mark as incomplete/i
            : /标记为完成|Mark as complete/i,
        })
        .click();
      expect((await changed).status()).toBe(200);
      await expect(visibleText(page, todo.title)).toHaveCount(0);
      expect(await todoState.read()).toEqual([
        expect.objectContaining({
          id: todo.id,
          title: todo.title,
          completed: !completed,
        }),
      ]);
      await destination.click();
      await expect(destination).toBeChecked();
      await expect(visibleText(page, todo.title)).toBeVisible();
      await captureStepScreenshot(page, testInfo, "workspace-todos-toggle");
    });
  }

  test("todo.web-completed-title", async ({ page, todos }, testInfo) => {
    await gotoAndWaitForReady(page, "/workspace/todos");

    const completedFilter = page
      .getByRole("radio", {
        name: /已完成|Completed/i,
      })
      .first();
    const completedTodo = visibleText(page, todos.completed.title);
    await completedFilter.click();
    await expect(completedTodo).toBeVisible({ timeout: 15_000 });

    const completedDetailButton = page
      .getByRole("button", {
        name: todos.completed.title,
        exact: true,
      })
      .first();
    await completedDetailButton.click();
    const completedDetail = page.getByRole("dialog", {
      name: todos.completed.title,
    });
    await expect(completedDetail).toBeVisible();
    await expect(
      completedDetail.locator('[data-slot="dialog-title"]'),
    ).toHaveCSS("text-decoration-line", "line-through");
    await expect(
      completedDetail.getByRole("button", {
        name: /取消完成|Mark as incomplete/i,
      }),
    ).toBeVisible();
    // The single-column popup moved the priority badge out of the dialog
    // description and into the facts table; the severity variant is unchanged.
    await expect(
      completedDetail
        .getByTestId("todo-detail-summary")
        .locator('[data-slot="badge"]')
        .first(),
    ).toHaveClass(/text-destructive/);
    await page.keyboard.press("Escape");

    await captureStepScreenshot(page, testInfo, "workspace-todos-completed");
  });

  test("todo.web-detail-actions", async ({ page, todos }, testInfo) => {
    await gotoAndWaitForReady(page, "/workspace/todos");

    await visibleText(page, todos.pending.title).first().click();

    const dialog = detailDialog(page);
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", {
        name: new RegExp(todos.pending.title),
      }),
    ).toBeVisible();
    const summary = dialog.getByTestId("todo-detail-summary");
    await expect(summary).toBeVisible();
    await expect(summary.getByText(/高|High/i).first()).toBeVisible();
    await expect(
      summary.getByText(/待处理|已完成|Pending|Completed/i).first(),
    ).toBeVisible();

    const actions = ["delete", "completion", "edit"] as const;
    const actionLabels = {
      delete: /删除待办|Delete todo/i,
      completion: /标记为完成|Mark as complete/i,
      edit: /编辑待办|Edit Todo/i,
    };
    const footer = dialog.locator('[data-slot="dialog-footer"]');
    const buttons = footer.getByRole("button");
    await expect(buttons).toHaveCount(actions.length);
    for (const [index, action] of actions.entries()) {
      await expect(buttons.nth(index)).toHaveAccessibleName(
        actionLabels[action],
      );
    }
    const observedActions = [];
    for (const button of await buttons.all()) {
      const label =
        (await button.getAttribute("aria-label")) ?? (await button.innerText());
      observedActions.push(
        Object.entries(actionLabels).find(([, pattern]) =>
          pattern.test(label),
        )?.[0],
      );
    }
    expect(observedActions).toEqual(actions);
    await expectDialogAction(dialog, /删除待办|Delete todo/i);
    await expectDialogAction(dialog, /编辑待办|Edit Todo/i);
    await expectDialogAction(dialog, /标记为完成|Mark as complete/i);

    await captureStepScreenshot(page, testInfo, "todos/detail-dialog");

    await closeDetailDialog(page, dialog);
  });

  test("嵌套待办路由渲染服务端操作错误", async ({
    page,
    todoState,
  }, testInfo) => {
    await gotoAndWaitForReady(page, "/workspace/todos");

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

    expect(await todoState.read()).toEqual([]);
    await captureStepScreenshot(page, testInfo, "workspace-todos-action-error");
  });

  test("todo.web-local-mutation-state", async ({
    page,
    todoState,
  }, testInfo) => {
    test.setTimeout(90_000);
    await gotoAndWaitForReady(page, "/workspace/todos");

    await page.evaluate(() => {
      document.documentElement.dataset.todoMutationSession = "retained";
    });
    const title = `e2e-workspace-todo-${Date.now()}`;
    const editedTitle = `${title}-edited`;

    // Create a new todo via modal form
    const addTodoButton = page
      .getByRole("button", { name: /添加待办|Add Todo/i })
      .first();
    await expect(addTodoButton).toBeVisible();
    await expect(addTodoButton).toBeEnabled();
    const titleInput = page.getByLabel(/标题|Title/i);
    await addTodoButton.click();
    await expect(titleInput).toBeVisible();
    await titleInput.fill(title);
    await page
      .getByRole("button", { name: /创建待办|Create Todo/i })
      .first()
      .click();

    await expect(visibleText(page, title)).toBeVisible({
      timeout: 15_000,
    });
    const [created] = await todoState.read();
    expect(created).toMatchObject({
      title,
      completed: false,
      priority: "medium",
    });
    await captureStepScreenshot(page, testInfo, "workspace-todos-created");

    // Edit the temporary todo via its detail modal.
    await visibleText(page, title).click();
    const detailDialog = page.getByRole("dialog", { name: title });
    await expect(detailDialog).toBeVisible();
    const summary = detailDialog.getByTestId("todo-detail-summary");
    await expect(summary).toBeVisible();
    const summaryText = await summary.innerText();
    const localizedPriorityMatches =
      summaryText.match(/\b(?:Low|Medium|High)\b|[低中高]/g) ?? [];
    expect(localizedPriorityMatches).toHaveLength(1);
    expect(summaryText).not.toMatch(/\b(?:low|medium|high)\b/);
    // #1027 keeps priority severity visually encoded; the single-column
    // popup moved that badge from the dialog description into the facts
    // table, so assert the variant where it now lives.
    await expect(summary.locator('[data-slot="badge"]').first()).toHaveClass(
      /bg-secondary/,
    );
    const editButton = detailDialog.getByRole("button", {
      name: /编辑待办|Edit Todo/i,
    });
    await expect(editButton).toBeVisible();
    await expect(editButton).toBeEnabled();
    await expect(editButton.locator("svg")).toBeVisible();
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
    expect(await todoState.read()).toEqual([
      expect.objectContaining({
        id: created.id,
        title: editedTitle,
        completed: false,
      }),
    ]);
    await captureStepScreenshot(page, testInfo, "workspace-todos-edited");

    await page.getByRole("button", { name: editedTitle, exact: true }).click();
    const editedDetailDialog = page.getByRole("dialog", {
      name: editedTitle,
    });
    const detailTitle = editedDetailDialog.locator(
      '[data-slot="dialog-title"]',
    );
    await expect(detailTitle).toHaveText(editedTitle);
    const completed = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.url().includes(`/api/workspace/todos/${created.id}`),
    );
    await editedDetailDialog
      .getByRole("button", { name: /标记为完成|Mark as complete/i })
      .click();
    expect((await completed).status()).toBe(200);
    await expect(
      editedDetailDialog.getByRole("button", {
        name: /取消完成|Mark as incomplete/i,
      }),
    ).toBeEnabled();
    await page.keyboard.press("Escape");
    expect(await todoState.read()).toEqual([
      expect.objectContaining({
        id: created.id,
        title: editedTitle,
        completed: true,
      }),
    ]);
    const completedFilter = page.getByRole("radio", {
      name: /^(已完成|Completed)$/i,
    });
    const incompleteFilter = page.getByRole("radio", {
      name: /^(未完成|Incomplete)$/i,
    });
    const allFilter = page.getByRole("radio", { name: /^(全部|All)$/i });
    for (const filter of [
      incompleteFilter,
      completedFilter,
      allFilter,
      completedFilter,
    ]) {
      await filter.click();
      await expect(filter).toBeChecked();
      await expect(
        page.getByRole("button", { name: editedTitle, exact: true }),
      ).toHaveCount(filter === incompleteFilter ? 0 : 1);
    }
    await page.getByRole("button", { name: editedTitle, exact: true }).click();
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
    for (const filter of [
      allFilter,
      incompleteFilter,
      completedFilter,
      allFilter,
    ]) {
      await filter.click();
      await expect(filter).toBeChecked();
      await expect(
        page.getByRole("button", { name: editedTitle, exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: title, exact: true }),
      ).toHaveCount(0);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.dataset.todoMutationSession,
      ),
    ).toBe("retained");
    expect(await todoState.read()).toEqual([]);
    await captureStepScreenshot(page, testInfo, "workspace-todos-deleted");
  });

  test("移动端长标题和内容保持操作可达并按层级排列", async ({
    page,
    todoState,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 320, height: 568 });
    await gotoAndWaitForReady(page, "/workspace/todos");

    const titlePrefix = `e2e-workspace-todo-mobile-${Date.now()}`;
    const title = `${titlePrefix}-${"长标题".repeat(35)}`;
    const content = `${"这是用于验证待办详情滚动区域的长内容。 ".repeat(24)}\n\nmobile-content-marker`;

    const addTodoButton = page.getByTestId("workspace-todos-add");
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
    expect(await todoState.read()).toEqual([
      expect.objectContaining({ title, completed: false }),
    ]);

    await page.getByRole("button", { name: title, exact: true }).click();
    const detailDialog = page.getByRole("dialog", { name: title });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.getByText("mobile-content-marker")).toBeVisible();
    const closeButton = detailDialog.locator('[data-slot="dialog-close"]');
    await expect(closeButton).toBeVisible();
    await expect(closeButton).toBeInViewport();
    const closeBox = await closeButton.boundingBox();
    expect(closeBox).not.toBeNull();
    expect(closeBox?.width ?? 0).toBeGreaterThanOrEqual(24);

    const detailFooter = detailDialog.locator('[data-slot="dialog-footer"]');
    await expect(detailFooter).toBeInViewport();
    const deleteButton = detailFooter.getByRole("button", {
      name: /删除待办|Delete todo/i,
    });
    const completion = detailFooter.getByRole("button", {
      name: /标记为完成|Mark as complete/i,
    });
    const edit = detailFooter.getByRole("button", {
      name: /编辑待办|Edit Todo/i,
    });
    for (const control of [deleteButton, completion, edit]) {
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(240);
    }
    const [deleteBox, completionBox, editBox] = await Promise.all([
      deleteButton.boundingBox(),
      completion.boundingBox(),
      edit.boundingBox(),
    ]);
    expect(deleteBox?.y).toBeLessThan(
      completionBox?.y ?? Number.POSITIVE_INFINITY,
    );
    expect(completionBox?.y).toBeLessThan(
      editBox?.y ?? Number.POSITIVE_INFINITY,
    );
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
    expect(await todoState.read()).toEqual([]);
  });

  test("短视口待办新建和编辑弹窗保持标题、滚动体与操作可达", async ({
    page,
    todoState,
  }) => {
    test.setTimeout(90_000);
    const viewport = { width: 390, height: 600 } as const;
    await page.setViewportSize(viewport);
    await gotoAndWaitForReady(page, "/workspace/todos");

    const titlePrefix = `e2e-workspace-todo-short-${Date.now()}`;
    const title = `${titlePrefix}-todo`;

    async function assertDialogBounds(
      dialog: import("@playwright/test").Locator,
    ) {
      const dialogBox = await dialog.boundingBox();
      const footer = dialog.locator('[data-slot="dialog-footer"]');
      const closeButton = dialog.getByRole("button", { name: "Close" });
      const [footerBox, closeBox] = await Promise.all([
        footer.boundingBox(),
        closeButton.boundingBox(),
      ]);
      expect(dialogBox).not.toBeNull();
      expect(footerBox).not.toBeNull();
      expect(closeBox).not.toBeNull();
      if (!dialogBox || !footerBox || !closeBox) {
        throw new Error("Expected the short-viewport todo dialog bounds");
      }
      expect(dialogBox.y).toBeGreaterThanOrEqual(16);
      expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(
        viewport.height - 16,
      );
      expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(
        viewport.height - 16,
      );
      expect(closeBox.width).toBeGreaterThanOrEqual(44);
      expect(closeBox.height).toBeGreaterThanOrEqual(44);
      await expect(footer).toBeInViewport();
      await expect(closeButton).toBeInViewport();

      const calendarButton = dialog.getByRole("button", {
        name: /打开日历选择器|Open calendar picker/i,
      });
      const calendarBox = await calendarButton.boundingBox();
      expect(calendarBox).not.toBeNull();
      expect(calendarBox?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(calendarBox?.height ?? 0).toBeGreaterThanOrEqual(44);
      await expect(calendarButton).toBeInViewport();

      const scrollViewport = dialog
        .locator('[data-slot="scroll-area-viewport"]')
        .first();
      const scrollMetrics = await scrollViewport.evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }));
      expect(scrollMetrics.clientHeight).toBeGreaterThan(0);
      expect(scrollMetrics.scrollHeight).toBeGreaterThanOrEqual(
        scrollMetrics.clientHeight,
      );
      const scrollBox = await scrollViewport.boundingBox();
      expect(scrollBox).not.toBeNull();
      expect(scrollBox?.y ?? 0).toBeGreaterThanOrEqual(dialogBox.y);
      expect(scrollBox?.y ?? 0).toBeLessThan(footerBox.y);
    }

    await page.getByTestId("workspace-todos-add").click();
    const createDialog = page.getByRole("dialog", {
      name: /新建待办|New Todo/i,
    });
    await expect(createDialog).toBeVisible();
    await assertDialogBounds(createDialog);

    await createDialog.getByLabel(/^(标题|Title)$/i).fill(title);
    await createDialog
      .getByRole("textbox", { name: /内容描述|Description/i })
      .fill("short viewport regression content");
    await createDialog
      .getByRole("button", { name: /创建待办|Create Todo/i })
      .click();
    await expect(visibleText(page, title)).toBeVisible({ timeout: 15_000 });
    expect(await todoState.read()).toEqual([
      expect.objectContaining({ title, completed: false }),
    ]);

    await page.getByRole("button", { name: title, exact: true }).click();
    const detailDialog = page.getByRole("dialog", { name: title });
    await expect(detailDialog).toBeVisible();
    await detailDialog
      .getByRole("button", { name: /编辑待办|Edit Todo/i })
      .click();

    const editDialog = page.getByRole("dialog", {
      name: /编辑待办|Edit Todo/i,
    });
    await expect(editDialog).toBeVisible();
    await assertDialogBounds(editDialog);
    await editDialog.getByRole("button", { name: /取消|Cancel/i }).click();
    await expect(editDialog).toBeHidden();
  });
});
