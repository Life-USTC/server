/** Global timetable activation owns a private database and Worker in every case. */
import { expect } from "@playwright/test";
import { adminWriteChecks } from "../../../../utils/admin-fixture";
import { expectRequiresSignIn } from "../../../../utils/auth";
import { observeAction } from "../../../../utils/observed-action";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../utils/page-ready";
import { test } from "./_fixture";

test.describe.configure({ mode: "parallel" });
test.use({ locale: "en-US" });

test("/admin/bus 未登录重定向到登录页", { tag: "@Bus/Web" }, async ({
  page,
}) => {
  await expectRequiresSignIn(page, "/admin/bus");
});

test("/admin/bus 普通用户访问返回 403", { tag: "@Bus/Web" }, async ({
  pageRun,
  page,
  isolatedWorker,
}) => {
  await pageRun(
    async () => {
      const ordinary = await isolatedWorker.createActor();
      await page.context().addCookies([ordinary.cookie]);
      const response = await page.goto("/admin/bus");
      expect(response?.status()).toBe(403);
      await expect(page.getByText("403").first()).toBeVisible();
      await expect(page.getByText("Forbidden").first()).toBeVisible();
    },
    async () => {
      throw new Error("Read-only authorization case submitted a browser write");
    },
  );
});

test("/admin/bus 显示所有必需的版本字段", { tag: "@Bus/Web" }, async ({
  adminFlow,
  run,
  page,
  admin,
  busState,
}) => {
  await run(() =>
    adminFlow.run(
      async () => {
        void admin;
        await gotoAndWaitForReady(page, "/admin/bus");
        await expect(
          page.getByRole("heading", { name: /Bus Management|校车管理/i }),
        ).toBeVisible();
        const row = page
          .locator("tbody tr:visible")
          .filter({ hasText: busState.versions[0].key });
        await expect(row).toContainText(busState.versions[0].title);
        await expect(row).toContainText(busState.versions[0].key);
        await expect(row.getByRole("cell").nth(3)).toHaveText("2020-01-01 - —");
        await expect(row.getByRole("cell").nth(4)).toHaveText(
          "Jan 1, 2026, 8:00 AM",
        );
        await expect(row.getByRole("cell").nth(5)).toHaveText(/Active|启用/i);
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/bus 版本表格包含班次数量", { tag: "@Bus/Web" }, async ({
  adminFlow,
  run,
  page,
  admin,
  busState,
}) => {
  await run(() =>
    adminFlow.run(
      async () => {
        void admin;
        await gotoAndWaitForReady(page, "/admin/bus");
        for (const version of busState.versions) {
          const row = page
            .locator("tbody tr:visible")
            .filter({ hasText: version.key });
          await expect(row.getByRole("cell").nth(2)).toHaveText("2");
        }
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/bus 主导航入口可见且可跳转", { tag: "@Bus/Web" }, async ({
  adminFlow,
  run,
  page,
  admin,
  busState,
}) => {
  await run(() =>
    adminFlow.run(
      async () => {
        void admin;
        void busState;
        await gotoAndWaitForReady(page, "/admin/users");
        const link = page
          .getByTestId("app-sidebar")
          .getByRole("link", { name: /校车管理|Bus Management/i });
        await expect(link).toBeVisible();
        await link.click();
        await expect(page).toHaveURL(/\/admin\/bus$/);
        await waitForUiSettled(page);
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("/admin/bus 激活版本受保护且导入弹窗可打开", { tag: "@Bus/Web" }, async ({
  adminFlow,
  run,
  page,
  admin,
  busState,
  isolatedWorker,
}) => {
  await run(() =>
    adminFlow.run(
      async () => {
        void admin;
        await gotoAndWaitForReady(page, "/admin/bus");
        const current = busState.versions[0];
        const row = page
          .locator("tbody tr:visible")
          .filter({ hasText: current.key });
        await expect(
          row.getByRole("button", { name: /删除|Delete/i }),
        ).toHaveCount(0);
        await page
          .getByRole("button", { name: /从 Static 导入|Import from Static/i })
          .click();
        const dialog = page.getByRole("dialog", {
          name: /从 Static 导入|Import from Static/i,
        });
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: /取消|Cancel/i }).click();
        await expect(dialog).toBeHidden();
        expect(
          await isolatedWorker.database.owner.busScheduleVersion.count(),
        ).toBe(2);
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

for (const initiallyActive of [0, 1])
  test.describe(`isolated active state ${initiallyActive}`, () => {
    test.use({ initiallyActive });
    test("/admin/bus 激活非当前版本需要二次确认", { tag: "@Bus/Web" }, async ({
      adminFlow,
      run,
      page,
      request,
      admin,
      busState,
      isolatedWorker,
    }) => {
      await run(() =>
        adminFlow.run(
          async () => {
            const db = isolatedWorker.database.owner;
            const current = busState.versions[initiallyActive];
            const next = busState.versions[1 - initiallyActive];
            const before = await request.get("/api/catalog/bus");
            expect(before.status()).toBe(200);
            expect((await before.json()).version.key).toBe(current.key);
            await gotoAndWaitForReady(page, "/admin/bus");
            const row = page
              .locator("tbody tr:visible")
              .filter({ hasText: next.key });
            const activate = row.getByRole("button", {
              name: /激活版本|Activate version/i,
            });
            await activate.click();
            const dialog = page.getByRole("alertdialog", {
              name: /激活该时刻表版本|Activate timetable version/i,
            });
            await expect(dialog).toBeVisible();
            await expect(dialog).toContainText(next.key);
            await dialog.getByRole("button", { name: /取消|Cancel/i }).click();
            await expect(dialog).toBeHidden();
            expect(
              await db.busScheduleVersion.findMany({
                where: { isEnabled: true },
                select: { id: true },
              }),
            ).toEqual([{ id: current.id }]);
            await activate.click();
            const response = observeAction(
              () =>
                page.waitForResponse(
                  (response) =>
                    response.request().method() === "POST" &&
                    response.url().includes("activateVersion"),
                ),
              () =>
                dialog
                  .getByRole("button", {
                    name: /确认激活版本|Activate version/i,
                  })
                  .click(),
            );
            expect((await response).status()).toBe(200);
            await expect(dialog).toBeHidden();
            await expect(row.getByRole("cell").nth(5)).toHaveText(
              /Active|启用/i,
            );
            await expect(
              row.getByRole("button", { name: /激活版本|Activate version/i }),
            ).toHaveCount(0);
            expect(
              await db.busScheduleVersion.findMany({
                orderBy: { id: "asc" },
                select: { key: true, isEnabled: true },
              }),
            ).toEqual([
              {
                key: busState.versions[0].key,
                isEnabled: initiallyActive === 1,
              },
              {
                key: busState.versions[1].key,
                isEnabled: initiallyActive === 0,
              },
            ]);
            expect(
              await db.auditLog.findMany({
                where: { action: "admin_bus_version_activate" },
                select: { userId: true, targetId: true },
              }),
            ).toEqual([{ userId: admin.id, targetId: String(next.id) }]);
            const after = await request.get("/api/catalog/bus");
            expect(after.status()).toBe(200);
            expect((await after.json()).version.key).toBe(next.key);
          },
          { auditActions: { admin_bus_version_activate: 1 } },
          adminWriteChecks([["POST", "/admin/bus", 200]]),
        ),
      );
    });
  });

test("/admin/bus 移动端首条版本操作可达", { tag: "@Bus/Web" }, async ({
  adminFlow,
  run,
  page,
  admin,
  busState,
}) => {
  await run(() =>
    adminFlow.run(
      async () => {
        void admin;
        void busState;
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoAndWaitForReady(page, "/admin/bus");
        const workspace = page.getByTestId("admin-workspace");
        const firstVersion = page
          .getByTestId("admin-bus-mobile-list")
          .locator("[data-slot='item']")
          .first();
        await expect(workspace).toBeVisible();
        await expect(workspace.locator("table")).toBeHidden();
        await expect(firstVersion).toBeVisible();
        await expect(firstVersion).toBeInViewport();
        await page
          .getByRole("button", { name: /从 Static 导入|Import from Static/i })
          .click();
        const dialog = page.getByRole("dialog", {
          name: /从 Static 导入|Import from Static/i,
        });
        await expect(dialog).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(390);
        await dialog.getByRole("button", { name: /取消|Cancel/i }).click();
        await expect(dialog).toBeHidden();
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

test("页面契约", { tag: "@Bus/Web" }, async ({
  adminFlow,
  run,
  page,
  admin,
  busState,
}) => {
  await run(() =>
    adminFlow.run(
      async () => {
        void admin;
        void busState;
        const response = await gotoAndWaitForReady(page, "/admin/bus", {
          browserHealth: {},
          expectMeaningfulContent: true,
          expectNoHorizontalOverflow: true,
          uiQuality: {},
        });
        expect(response?.ok()).toBe(true);
        await expect(page.locator("#main-content")).toBeVisible();
        await expect(
          page.getByRole("heading", { name: /校车管理|Bus Management/i }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: /导入|Import/i }),
        ).toBeVisible();
      },
      {},
      adminWriteChecks([]),
    ),
  );
});
