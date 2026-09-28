import { expect, type Page } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { absoluteTestUrl } from "../../../../utils/request-url";
import { test } from "../../../../utils/todo-fixture";

test.describe.configure({ mode: "parallel" });
const widths = [1280, 390];
function surface(page: Page, width: number) {
  return width >= 768
    ? page.getByRole("table")
    : page.getByTestId("workspace-todos-cards");
}

for (const width of widths) {
  test(`todo.mobile-toolbar-priority ${width}`, async ({
    page,
    todos: _todos,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await gotoAndWaitForReady(page, "/workspace/todos");
    const rendered = surface(page, width);
    await expect(rendered).toBeVisible();
    await expect(surface(page, width === 390 ? 1280 : 390)).toBeHidden();
    for (const label of [
      /^(未完成|Incomplete)$/i,
      /^(已完成|Completed)$/i,
      /^(全部|All)$/i,
    ]) {
      const filter = page.getByRole("radio", { name: label });
      await expect(filter).toBeVisible();
      const box = await filter.boundingBox();
      if (width < 768) {
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
      if (!box) throw new Error("Visible filter must have bounds");
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await filter.click();
      await expect(filter).toBeChecked();
    }
    await expect(page.getByTestId("workspace-todos-view-menu")).toHaveCount(0);
    await expect(
      page.getByRole("radio", { name: /列表|List|卡片|Cards/i }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

for (const locale of ["zh-CN", "en-US"] as const) {
  for (const width of widths) {
    test(`todo.web-detail ${locale}/${width}`, async ({
      page,
      baseURL,
      todoState,
    }) => {
      const fixtures = await todoState.seed(
        (["low", "medium", "high"] as const).map((priority) => ({
          title: `Known ${priority} priority`,
          priority,
        })),
      );
      await page.context().addCookies([
        {
          name: "NEXT_LOCALE",
          value: locale.toLowerCase(),
          url: absoluteTestUrl("/", baseURL),
        },
      ]);
      await page.setViewportSize({ width, height: 844 });
      await gotoAndWaitForReady(page, "/workspace/todos");
      for (const { title, priority } of fixtures) {
        const expected =
          locale === "en-US"
            ? { low: "Low", medium: "Medium", high: "High" }[priority]
            : { low: "低", medium: "中", high: "高" }[priority];
        const row =
          width >= 768
            ? surface(page, width).getByRole("row").filter({ hasText: title })
            : surface(page, width)
                .locator('[data-slot="item"]')
                .filter({ hasText: title });
        const badge = row
          .locator('[data-slot="badge"]')
          .filter({ hasText: new RegExp(`^${expected}$`) });
        await expect(badge).toBeVisible();
        const color = await badge.evaluate((node) => ({
          background: getComputedStyle(node).backgroundColor,
          color: getComputedStyle(node).color,
          border: getComputedStyle(node).borderColor,
        }));
        await row.getByRole("button", { name: title, exact: true }).click();
        const dialog = page.getByRole("dialog", { name: title, exact: true });
        const detailBadge = dialog
          .getByTestId("todo-detail-summary")
          .locator('[data-slot="badge"]')
          .filter({ hasText: new RegExp(`^${expected}$`) });
        await expect(detailBadge).toBeVisible();
        expect(
          await detailBadge.evaluate((node) => ({
            background: getComputedStyle(node).backgroundColor,
            color: getComputedStyle(node).color,
            border: getComputedStyle(node).borderColor,
          })),
        ).toEqual(color);
        await expect(
          dialog.getByTestId("todo-detail-summary"),
        ).not.toContainText(new RegExp(`\\b${priority}\\b`));
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
      }
    });
  }
}

for (const width of widths) {
  test(`todo.web-list-state ${width}`, async ({ page, todoState }) => {
    await todoState.seed([{ title: "Known incomplete todo" }]);
    await page.setViewportSize({ width, height: 844 });
    await gotoAndWaitForReady(page, "/workspace/todos");
    const all = page.getByRole("radio", { name: /^(全部|All)$/i });
    const completed = page.getByRole("radio", {
      name: /^(已完成|Completed)$/i,
    });
    const incomplete = page.getByRole("radio", {
      name: /^(未完成|Incomplete)$/i,
    });
    for (const filter of [completed, completed, all, incomplete, completed]) {
      await filter.click();
      await expect(filter).toBeChecked();
      const empty = surface(page, width).locator('[data-slot="empty"]');
      if (filter === completed) {
        await expect(empty).toBeVisible();
        await expect(
          surface(page, width).getByRole("button", {
            name: /标记为完成|Mark as complete|取消完成|Mark as incomplete/i,
          }),
        ).toHaveCount(0);
      } else await expect(empty).toHaveCount(0);
    }
    await surface(page, width)
      .locator('[data-slot="empty-content"]')
      .getByRole("button")
      .click();
    await expect(all).toBeChecked();
    await expect(
      surface(page, width).locator('[data-slot="empty"]'),
    ).toHaveCount(0);
  });
}

for (const width of widths) {
  test(`todo.web-due-order ${width}`, async ({ page, todoState }) => {
    const prefix = `due-order-${crypto.randomUUID()}`;
    const anchor = new Date(Math.floor(Date.now() / 60_000) * 60_000);
    const offset = (hours: number) =>
      new Date(anchor.getTime() + hours * 3_600_000).toISOString();
    const inputs = [
      { title: `${prefix}-old`, dueAt: offset(-180 * 24) },
      { title: `${prefix}-tomorrow`, dueAt: offset(24) },
      { title: `${prefix}-future-tie`, dueAt: offset(1) },
      { title: `${prefix}-past-tie`, dueAt: offset(-1) },
      { title: `${prefix}-undated`, dueAt: null },
    ];
    const expected = [0, 3, 2, 1, 4].map((index) => inputs[index].title);
    const fixtures = await todoState.seed(
      inputs.map((input) => ({
        ...input,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
      })),
    );
    await page.setViewportSize({ width, height: 844 });
    await gotoAndWaitForReady(page, "/workspace/todos");
    const list = surface(page, width);
    const titles = list.getByRole("button").filter({ hasText: prefix });
    for (const label of [/^(全部|All)$/i, /^(未完成|Incomplete)$/i]) {
      await page.getByRole("radio", { name: label }).click();
      await expect(titles).toHaveText(expected);
    }
    for (const { title, id } of fixtures) {
      const row =
        width >= 768
          ? list.getByRole("row").filter({ hasText: title })
          : list.locator('[data-slot="item"]').filter({ hasText: title });
      const completed = page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          response.url().includes(`/api/workspace/todos/${id}`),
      );
      await row
        .getByRole("button", { name: /标记为完成|Mark as complete/i })
        .click();
      expect((await completed).status()).toBe(200);
      await expect(
        list.getByRole("button", { name: title, exact: true }),
      ).toHaveCount(0);
    }
    const completedRows = await todoState.read();
    expect(completedRows).toHaveLength(fixtures.length);
    expect(completedRows).toEqual(
      expect.arrayContaining(
        fixtures.map(({ id }) =>
          expect.objectContaining({ id, completed: true }),
        ),
      ),
    );
    await page.getByRole("radio", { name: /^(已完成|Completed)$/i }).click();
    await expect(titles).toHaveText(expected);
    await list
      .getByRole("button", { name: inputs[0].title, exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /编辑待办|Edit Todo/i })
      .click();
    const editor = page.getByRole("dialog", { name: /编辑待办|Edit Todo/i });
    await editor
      .locator('input[name="dueAt"]')
      .fill(
        new Date(anchor.getTime() + 8.5 * 3_600_000).toISOString().slice(0, 16),
      );
    await editor
      .getByRole("button", { name: /保存修改|Save Changes/i })
      .click();
    await expect(editor).toBeHidden();
    const changed = (await todoState.read()).find(
      (todo) => todo.id === fixtures[0].id,
    );
    expect(changed).toMatchObject({
      completed: true,
      dueAt: new Date(anchor.getTime() + 0.5 * 3_600_000),
    });
    // Editing the oldest deadline moves it between the adjacent deadlines.
    const reordered = [3, 0, 2, 1, 4].map((index) => inputs[index].title);
    await expect(titles).toHaveText(reordered);
    await page.getByRole("radio", { name: /^(全部|All)$/i }).click();
    await expect(titles).toHaveText(reordered);
  });
}
