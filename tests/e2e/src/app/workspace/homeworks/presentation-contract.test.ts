import { expect, type Page, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { cleanupHomeworksForE2e } from "../../../../utils/homeworks";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { ensureSeedSectionSubscription } from "../../../../utils/subscriptions";

const widths = [1280, 390];
let homeworks: { id: string; title: string; major: boolean }[] = [];
const description =
  "Private assignment instructions: submit a PDF with the derivation.";
function list(page: Page, width: number) {
  return page.getByTestId(
    width >= 768 ? "workspace-homeworks-list" : "workspace-homeworks-cards",
  );
}
function row(page: Page, width: number, title: string) {
  return width >= 768
    ? list(page, width).getByRole("row").filter({ hasText: title })
    : list(page, width)
        .locator('[data-slot="item"]')
        .filter({ hasText: title });
}
async function open(page: Page, width: number, title: string) {
  await row(page, width, title)
    .getByRole("button", { name: title, exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: title, exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.beforeEach(async ({ page }) => {
  homeworks = [];
  await signInAsDebugUser(page, "/workspace/homeworks");
  await ensureSeedSectionSubscription(page);
  for (const major of [false, true]) {
    const title = `homework-presentation-${major}-${crypto.randomUUID()}`;
    const response = await page.request.post(
      "/api/community/section-homeworks",
      {
        data: {
          sectionJwId: DEV_SEED.section.jwId,
          title,
          description,
          isMajor: major,
          requiresTeam: major,
          publishedAt: "2026-01-01T09:10:00+08:00",
          submissionStartAt: "2026-01-02T10:20:00+08:00",
          submissionDueAt: "2099-01-03T12:30:00+08:00",
        },
      },
    );
    expect(response.status()).toBe(201);
    homeworks.push({ id: (await response.json()).id, title, major });
  }
});
test.afterEach(async () =>
  cleanupHomeworksForE2e(homeworks.map((item) => item.id)),
);

test("homework.responsive-workspace-view", async ({ page }) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    await gotoAndWaitForReady(page, "/workspace/homeworks");
    await expect(list(page, width)).toBeVisible();
    await expect(list(page, width >= 768 ? 390 : 1280)).toBeHidden();
    for (const label of [
      /^(未完成|Incomplete)$/i,
      /^(已完成|Completed)$/i,
      /^(全部|All)$/i,
    ]) {
      const filter = page.getByRole("radio", { name: label });
      await expect(filter).toBeVisible();
      await filter.click();
      await expect(filter).toBeChecked();
    }
    await expect(page.getByTestId("workspace-homeworks-view-menu")).toHaveCount(
      0,
    );
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

test("homework.compact-card-list-surface", async ({ page }) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    await gotoAndWaitForReady(page, "/workspace/homeworks");
    for (const { title, major } of homeworks) {
      const summary = row(page, width, title);
      await expect(
        summary.getByRole("button", { name: title, exact: true }),
      ).toBeVisible();
      await expect(summary).toContainText(
        new RegExp(`${DEV_SEED.course.nameCn}|${DEV_SEED.course.nameEn}`),
      );
      await expect(summary).toContainText("12:30");
      await expect(summary).toContainText(/还剩|left/i);
      await expect(
        summary.getByRole("button", { name: /标记为完成|Mark as complete/i }),
      ).toBeVisible();
      for (const label of [
        /^(大作业|重要|Major|Major assignment)$/i,
        /^(需要组队|Team required|Requires team)$/i,
      ]) {
        if (major) await expect(summary.getByText(label)).toBeVisible();
        else await expect(summary.getByText(label)).toHaveCount(0);
      }
      await expect(
        summary.getByText(/^(普通作业|常规作业|Standard|Default|Regular)$/i),
      ).toHaveCount(0);
      await expect(summary).not.toContainText(description);
    }
  }
});

test("homework.detail-secondary-content", async ({ page }) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    await gotoAndWaitForReady(page, "/workspace/homeworks");
    const title = homeworks[1].title;
    const summary = row(page, width, title);
    await expect(summary).not.toContainText(description);
    await expect(summary).not.toContainText(
      /发布日期|Published|提交开始|Submission opens|作业讨论|Homework discussion/i,
    );
    const dialog = await open(page, width, title);
    await expect(dialog.getByTestId("homework-description")).toContainText(
      description,
    );
    const metadata = dialog.getByTestId("homework-secondary-details");
    await expect(metadata).toContainText(/发布日期|Published/i);
    await expect(metadata).toContainText(/提交开始|Submission opens/i);
    await expect(metadata).toContainText(/0?9:10/);
    await expect(metadata).toContainText("10:20");
    await expect(
      dialog
        .getByTestId("homework-discussion")
        .getByRole("heading", { name: /作业讨论|Homework discussion/i }),
    ).toBeVisible();
    await expect(
      dialog.locator(`a[href="/catalog/sections/${DEV_SEED.section.jwId}"]`),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
});

test("homework.detail-dialog-dismissal", async ({ page }) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    await gotoAndWaitForReady(page, "/workspace/homeworks");
    const title = homeworks[0].title;
    const dialog = await open(page, width, title);
    const bounds = await dialog.boundingBox();
    if (!bounds) throw new Error("Expected dialog bounds");
    if (width >= 768) {
      const overlay = await page
        .locator('[data-slot="dialog-overlay"]')
        .boundingBox();
      if (!overlay) throw new Error("Expected modal backdrop bounds");
      expect(
        Math.abs(bounds.x + bounds.width / 2 - overlay.x - overlay.width / 2),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(bounds.y + bounds.height / 2 - overlay.y - overlay.height / 2),
      ).toBeLessThanOrEqual(1);
      await page.mouse.click(5, 5);
    } else {
      expect(bounds).toMatchObject({ x: 0, y: 0, width, height: 844 });
      await dialog.getByRole("button", { name: /^(Close|关闭)$/i }).click();
    }
    await expect(dialog).toBeHidden();
    await open(page, width, title);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
});
