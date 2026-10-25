import { expect } from "@playwright/test";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import { test as workerTest } from "../../../utils/owned-worker";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import {
  applyWorkspaceTaskFilter,
  openWorkspaceTaskFilter,
  workspaceTaskFilterControl,
} from "../../../utils/workspace-task-filters";

const test = workerTest.extend<{
  browserRun: (work: () => Promise<void>) => Promise<void>;
}>({
  browserRun: async ({ page, run }, use) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work) => workflow.run(() => run(() => workflow.body(work))));
    });
  },
});
test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });

for (const locale of ["zh-cn", "en-us"] as const) {
  for (const width of [1280, 390]) {
    test(`demo.homeworks: read-only browsing ${locale} ${width}`, {
      tag: "@Homework/Web",
    }, async ({ page, isolatedWorker, browserRun }) => {
      await browserRun(async () => {
        const english = locale === "en-us";
        const title = english ? "Vector spaces exercises" : "向量空间练习";
        const completed = english
          ? "Matrix operations exercises"
          : "矩阵运算练习";
        const advisory = english ? "Mechanics further reading" : "力学拓展阅读";
        await page.setViewportSize({ width, height: 844 });
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
        await gotoAndWaitForReady(page, "/account/sign-in");
        await page
          .getByRole("button", {
            name: english ? "Enter demo" : "进入演示",
            exact: true,
          })
          .click();
        await expect(page).toHaveURL(/\/workspace\/todos$/);
        await waitForUiSettled(page);
        await gotoAndWaitForReady(page, "/workspace/homeworks", {
          browserHealth: {},
          expectNoHorizontalOverflow: true,
          uiQuality: {},
        });
        const surface = page.getByTestId(
          width === 1280
            ? "workspace-homeworks-list"
            : "workspace-homeworks-cards",
        );
        await expect(
          surface.getByRole("button", { name: title, exact: true }),
        ).toBeVisible();
        await expect(
          surface.getByRole("button", { name: completed, exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByTestId("workspace-homeworks-add"),
        ).toBeDisabled();
        const bootstrap = await page.request.get("/_internal/shell-bootstrap");
        expect(await bootstrap.json()).toMatchObject({
          navigation: { pendingHomeworksCount: 3 },
          demo: { referenceNow: "2026-09-24T09:00:00+08:00" },
        });
        const workspace = await page.request.get("/api/workspace/homeworks");
        expect((await workspace.json()).data).toHaveLength(6);
        await openWorkspaceTaskFilter(page, "homeworks");
        await applyWorkspaceTaskFilter(
          page,
          workspaceTaskFilterControl(page, english ? "All" : "全部"),
        );
        await page.keyboard.press("Escape");
        await expect(
          surface.getByRole("button", { name: completed, exact: true }),
        ).toBeVisible();
        await expect(
          surface.getByRole("button", { name: advisory, exact: true }),
        ).toBeVisible();
        const completionButtons = surface.getByRole("button", {
          name: /标记为完成|取消完成|Mark as complete|Mark as incomplete/i,
        });
        await expect(completionButtons).toHaveCount(4);
        for (const button of await completionButtons.all())
          await expect(button).toBeDisabled();
        await page.clock.install();
        await surface.getByRole("button", { name: title, exact: true }).click();
        const dialog = page.getByRole("dialog", { name: title, exact: true });
        await expect(dialog).toBeVisible();
        await expect(dialog.locator("[data-slot=skeleton]")).toHaveCount(0);
        await expect(dialog.getByTestId("homework-description")).toContainText(
          english ? "explain your reasoning" : "推导过程",
        );
        await expect(dialog).toContainText(
          english
            ? "Changes and external actions are disabled."
            : "无法修改数据或执行外部操作",
        );
        await expect(
          dialog.getByRole("button", { name: /标记为完成|Mark as complete/i }),
        ).toBeDisabled();
        await expect(dialog.getByRole("textbox")).toHaveCount(0);
        const deadline = dialog.getByTestId("homework-deadline-summary");
        const before = await deadline.innerText();
        await page.clock.fastForward(61_000);
        await expect(deadline).toHaveText(before);
        await dialog.locator('a[href="/catalog/sections/910001"]').click();
        await expect(page).toHaveURL(/\/catalog\/sections\/910001$/);
        await gotoAndWaitForReady(
          page,
          "/catalog/sections/910001?homeworkId=demo-homework-vectors",
        );
        await expect(
          page.getByRole("dialog", { name: title, exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("dialog").getByTestId("homework-description"),
        ).toContainText(english ? "explain your reasoning" : "推导过程");
        await expect(
          page
            .getByRole("dialog")
            .getByRole("button", { name: /标记为完成|Mark as complete/i }),
        ).toBeDisabled();
        await expect(
          page
            .getByRole("dialog")
            .getByRole("button", { name: /^(编辑作业|Edit homework)$/i }),
        ).toHaveCount(0);
        await page.keyboard.press("Escape");
        await gotoAndWaitForReady(page, "/workspace/homeworks");
        await expect(
          surface.getByRole("button", { name: title, exact: true }),
        ).toBeVisible();
        for (const [method, path] of [
          ["POST", "/api/community/section-homeworks"],
          ["PATCH", "/api/community/section-homeworks/demo-homework-vectors"],
          [
            "POST",
            "/api/community/section-homeworks/demo-homework-vectors/completion",
          ],
          ["POST", "/api/community/comments"],
        ]) {
          const response = await page.request.fetch(path, {
            method,
            data: {},
            headers: { origin: isolatedWorker.origin },
          });
          expect(response.status()).toBe(403);
          await response.body();
        }
      });
    });
  }
}
