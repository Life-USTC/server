import { expect, type Page, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../../utils/workspace-task-filters";

const widths = [1280, 390];
function surface(page: Page, width: number) {
  return width >= 768
    ? page.getByRole("table")
    : page.getByTestId("workspace-todos-cards");
}

test("todo.mobile-toolbar-priority", async ({ page }) => {
  await signInAsDebugUser(page, "/workspace/todos");
  for (const width of widths) {
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
  }
});

test("todo.web-detail", async ({ page }) => {
  test.setTimeout(120_000);
  await signInAsDebugUser(page, "/workspace/todos");
  const fixtures: {
    id: string;
    title: string;
    priority: "low" | "medium" | "high";
  }[] = [];
  try {
    for (const priority of ["low", "medium", "high"] as const) {
      const title = `priority-${priority}-${crypto.randomUUID()}`;
      const response = await page.request.post("/api/workspace/todos", {
        data: { title, priority },
      });
      expect(response.status()).toBe(201);
      fixtures.push({ id: (await response.json()).id, title, priority });
    }
    for (const locale of ["zh-CN", "en-US"] as const) {
      await page.context().addCookies([
        {
          name: "NEXT_LOCALE",
          value: locale.toLowerCase(),
          url: new URL(page.url()).origin,
        },
      ]);
      for (const width of widths) {
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
      }
    }
  } finally {
    for (const { id } of fixtures)
      await page.request.delete(`/api/workspace/todos/${id}`);
  }
});

test("todo.web-list-state", async ({ page }) => {
  const id = crypto.randomUUID();
  const marker = `todo-filter-${id.slice(0, 8)}`;
  await withE2ePrisma((db) =>
    db.user.create({
      data: {
        id,
        username: marker,
        name: marker,
        email: `${marker}@test.invalid`,
        emailVerified: true,
      },
    }),
  );
  try {
    await page.context().addCookies([await createSignedSessionCookie(id)]);
    const created = await page.request.post("/api/workspace/todos", {
      data: { title: `${marker} incomplete` },
    });
    expect(created.status()).toBe(201);
    for (const width of widths) {
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
    }
  } finally {
    await withE2ePrisma((db) => db.user.delete({ where: { id } }));
  }
});

test("todo.web-due-order", async ({ page }) => {
  test.setTimeout(120_000);
  await signInAsDebugUser(page, "/workspace/todos");
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
  const ids: string[] = [];
  const expected = [0, 3, 2, 1, 4].map((index) => inputs[index].title);
  try {
    for (const data of inputs) {
      const response = await page.request.post("/api/workspace/todos", {
        data,
      });
      expect(response.ok()).toBe(true);
      ids.push((await response.json()).id);
    }
    for (const width of widths) {
      for (let index = 0; index < ids.length; index++)
        expect(
          (
            await page.request.patch(`/api/workspace/todos/${ids[index]}`, {
              data: { completed: false, dueAt: inputs[index].dueAt },
            })
          ).ok(),
        ).toBe(true);
      await page.setViewportSize({ width, height: 844 });
      await gotoAndWaitForReady(page, "/workspace/todos");
      const list = surface(page, width);
      const titles = list.getByRole("button").filter({ hasText: prefix });
      for (const label of [/^(全部|All)$/i, /^(未完成|Incomplete)$/i]) {
        await page.getByRole("radio", { name: label }).click();
        await expect(titles).toHaveText(expected);
      }
      for (const { title } of inputs) {
        const row =
          width >= 768
            ? list.getByRole("row").filter({ hasText: title })
            : list.locator('[data-slot="item"]').filter({ hasText: title });
        await row
          .getByRole("button", { name: /标记为完成|Mark as complete/i })
          .click();
        await expect(
          list.getByRole("button", { name: title, exact: true }),
        ).toHaveCount(0);
      }
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
          new Date(anchor.getTime() + 8.5 * 3_600_000)
            .toISOString()
            .slice(0, 16),
        );
      await editor
        .getByRole("button", { name: /保存修改|Save Changes/i })
        .click();
      await expect(editor).toBeHidden();
      // Editing the oldest deadline moves it between the adjacent deadlines.
      const reordered = [3, 0, 2, 1, 4].map((index) => inputs[index].title);
      await expect(titles).toHaveText(reordered);
      await page.getByRole("radio", { name: /^(全部|All)$/i }).click();
      await expect(titles).toHaveText(reordered);
    }
  } finally {
    for (const id of ids)
      await page.request.delete(`/api/workspace/todos/${id}`);
  }
});
