import { expect, type Locator, test } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createWorkspaceTaskFilterFixture } from "../../../utils/workspace-task-filters";

async function expectSelection(group: Locator, selected: string) {
  const states = await group.getByRole("radio").evaluateAll((elements) =>
    elements.map((element) => ({
      value: element.getAttribute("data-value"),
      checked: element.getAttribute("aria-checked"),
      state: element.getAttribute("data-state"),
      background: getComputedStyle(element).backgroundColor,
    })),
  );
  for (const active of [
    states.filter((state) => state.checked === "true"),
    states.filter((state) => state.state === "on"),
    states.filter((state) => state.background !== "rgba(0, 0, 0, 0)"),
  ]) {
    expect(active.map((state) => state.value)).toEqual([selected]);
  }
}

test("task filters respond after navigating between workspace pages", async ({
  page,
}) => {
  const fixture = await createWorkspaceTaskFilterFixture(page, {
    includePending: true,
  });
  try {
    await gotoAndWaitForReady(page, "/workspace/homeworks");
    for (const tab of ["todos", "exams", "homeworks", "todos"] as const) {
      await page
        .locator(`a[href="/workspace/${tab}"]`)
        .filter({ visible: true })
        .first()
        .click();
      await page.waitForURL(`**/workspace/${tab}`);
      const group = page
        .locator('[data-slot="toggle-group"]')
        .filter({ has: page.locator('[data-value="incomplete"]') });
      for (const value of ["all", "completed", "incomplete"]) {
        await group.locator(`[data-value="${value}"]`).click();
        await page.mouse.move(0, 0);
        await expectSelection(group, value);
        await expect(
          page
            .getByText(fixture.completedTitle[tab], { exact: tab !== "exams" })
            .filter({ visible: true }),
        ).toHaveCount(value === "incomplete" ? 0 : 1);
      }
    }
  } finally {
    await fixture.cleanup();
  }
});

for (const tab of ["homeworks", "todos", "exams"] as const) {
  for (const mobile of [false, true]) {
    for (const includePending of [false, true]) {
      test(`${tab} filters actual ${includePending ? "mixed" : "completed-only"} data on ${mobile ? "mobile" : "desktop"}`, async ({
        page,
      }) => {
        await page.setViewportSize(
          mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
        );
        const fixture = await createWorkspaceTaskFilterFixture(page, {
          includePending,
        });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        try {
          await gotoAndWaitForReady(page, `/workspace/${tab}`, {
            browserHealth: {},
          });
          const group = page
            .locator('[data-slot="toggle-group"]')
            .filter({ has: page.locator('[data-value="incomplete"]') });
          const completed = page
            .getByText(fixture.completedTitle[tab], { exact: tab !== "exams" })
            .filter({ visible: true });
          const pending = page
            .getByText(fixture.pendingTitle[tab], { exact: tab !== "exams" })
            .filter({ visible: true });
          await expectSelection(group, "incomplete");
          await expect(completed).toHaveCount(0);
          await expect(pending).toHaveCount(includePending ? 1 : 0);

          if (!includePending) {
            if (!mobile) {
              await expect(page.getByRole("table")).toBeVisible();
              await expect(
                page.getByRole("columnheader").first(),
              ).toBeVisible();
            }
            await page
              .getByRole("button", { name: /清除筛选|Clear filter/i })
              .filter({ visible: true })
              .click();
            await expectSelection(group, "all");
            await expect(completed).toHaveCount(1);
            await group.locator('[data-value="incomplete"]').click();
          }

          // Filtering loaded data must keep working without network access.
          await page.context().setOffline(true);
          for (const selected of ["all", "completed", "incomplete", "all"]) {
            const option = group.locator(`[data-value="${selected}"]`);
            for (const action of ["click", "click", "space"] as const) {
              if (action === "space") await option.press("Space");
              else await option.click();
              await page.mouse.move(0, 0);
              await expectSelection(group, selected);
              await expect(completed).toHaveCount(
                selected === "incomplete" ? 0 : 1,
              );
              await expect(pending).toHaveCount(
                includePending && selected !== "completed" ? 1 : 0,
              );
            }
          }
          await page.context().setOffline(false);
          // A fresh page uses the default filter, even if its result is empty.
          await gotoAndWaitForReady(page, `/workspace/${tab}`);
          await expectSelection(group, "incomplete");
          await expect(completed).toHaveCount(0);
          await expect(pending).toHaveCount(includePending ? 1 : 0);
          if (includePending && tab !== "exams") {
            const saved = page.waitForResponse(
              (response) =>
                response.url().includes(`/${tab}/`) &&
                ["POST", "PATCH", "PUT"].includes(response.request().method()),
            );
            await page
              .getByRole("button", { name: /标记为完成|Mark as complete/i })
              .filter({ visible: true })
              .click();
            expect((await saved).ok()).toBe(true);
            await page.mouse.move(0, 0);
            await expectSelection(group, "incomplete");
            await expect(pending).toHaveCount(0);
            await expect(completed).toHaveCount(0);
            await page
              .getByRole("button", { name: /清除筛选|Clear filter/i })
              .filter({ visible: true })
              .click();
            await expectSelection(group, "all");
            await expect(pending).toHaveCount(1);
            await expect(completed).toHaveCount(1);
            await gotoAndWaitForReady(page, `/workspace/${tab}`);
            await expectSelection(group, "incomplete");
            await expect(pending).toHaveCount(0);
            await group.locator('[data-value="completed"]').click();
            await expect(pending).toHaveCount(1);
          }
          expect(errors).toEqual([]);
        } finally {
          await page.context().setOffline(false);
          await fixture.cleanup();
        }
      });
    }
  }
}
