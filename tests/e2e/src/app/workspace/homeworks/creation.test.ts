import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { cleanupHomeworksForE2e } from "../../../../utils/homeworks";
import { visibleText } from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { ensureSeedSectionSubscription } from "../../../../utils/subscriptions";

test.describe("仪表盘作业", () => {
  test.describe.configure({ mode: "serial" });

  test("可以创建新作业", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    const addButton = page.getByTestId("workspace-homeworks-add").first();
    const title = `e2e-workspace-homework-${Date.now()}`;
    const titleInput = page.getByTestId("workspace-homework-title");
    await expect(async () => {
      await expect(addButton).toBeVisible({ timeout: 3_000 });
      await addButton.click();
      await expect(titleInput).toBeVisible({ timeout: 3_000 });
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });
    const createDialog = page.locator('[data-slot="dialog-content"]').first();
    await expect(
      createDialog.getByRole("group", { name: /说明|Details/i }),
    ).toBeVisible();
    await expect(
      createDialog.getByRole("group", {
        name: /提交截止|Submission due/i,
      }),
    ).toBeVisible();
    await titleInput.fill(title);

    let releaseCreateRequest: (() => void) | undefined;
    const createRequestHeld = new Promise<void>((resolve) => {
      releaseCreateRequest = resolve;
    });
    let createRequestIntercepted = false;
    let resolveCreateRouteHandled: (() => void) | undefined;
    const createRouteHandled = new Promise<void>((resolve) => {
      resolveCreateRouteHandled = resolve;
    });
    const createRoutePattern = "**/workspace/homeworks**";
    await page.route(createRoutePattern, async (route) => {
      if (
        route.request().method() !== "POST" ||
        !route.request().url().includes("createHomework")
      ) {
        await route.continue();
        return;
      }
      createRequestIntercepted = true;
      await createRequestHeld;
      try {
        await route.continue();
      } finally {
        resolveCreateRouteHandled?.();
      }
    });
    try {
      const createButton = page.getByTestId("workspace-homework-create");
      await createButton.click();
      await expect(titleInput).toBeDisabled();
      await expect(
        createDialog.locator('select[name="sectionId"]'),
      ).toBeDisabled();
      await expect(createButton).toBeDisabled();
    } finally {
      releaseCreateRequest?.();
      if (createRequestIntercepted) await createRouteHandled;
      await page.unroute(createRoutePattern);
    }

    await expect(visibleText(page, title)).toBeVisible({
      timeout: 15_000,
    });
    await captureStepScreenshot(page, testInfo, "homeworks/created");
  });

  test("新建作业保留英文输入提示并隐藏填写规范", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    const localeResponse = await page.request.post("/api/account/preferences", {
      data: { locale: "en-us" },
    });
    expect(localeResponse.status()).toBe(200);
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    await page.getByTestId("workspace-homeworks-add").first().click();
    const createDialog = page.locator('[data-slot="dialog-content"]').first();
    const titleInput = createDialog.getByTestId("workspace-homework-title");
    await expect(titleInput).toHaveAttribute(
      "placeholder",
      "e.g., 第一次作业 / 期中论文作业",
    );
    await expect(
      createDialog.getByRole("textbox", { name: "Details" }),
    ).toHaveAttribute("placeholder", /题目：/);

    await expect(
      createDialog.getByTestId("workspace-homework-style-guide-trigger"),
    ).toHaveCount(0);
    await expect(
      createDialog.locator('[data-slot="dialog-description"]'),
    ).toHaveCount(0);
    await expect(
      createDialog.getByTestId("workspace-homework-create"),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "homeworks/create-desktop");
  });

  test("创建作业时可设置重要、组队、截止日期和说明", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    const addButton = page.getByTestId("workspace-homeworks-add").first();
    const title = `e2e-workspace-hw-full-${Date.now()}`;
    const description = `e2e-workspace-hw-description-${Date.now()}`;
    const dueAt = "2026-12-31T23:59";
    const titleInput = page.getByTestId("workspace-homework-title");
    await expect(async () => {
      await expect(addButton).toBeVisible({ timeout: 3_000 });
      await addButton.click();
      await expect(titleInput).toBeVisible({ timeout: 3_000 });
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });

    let homeworkId: string | undefined;
    const createDialog = page.locator('[data-slot="dialog-content"]').first();
    const advancedSettings = createDialog.getByRole("button", {
      name: /其他可选设置|Other optional settings|收起其他可选设置|Hide optional settings/i,
    });
    await expect(advancedSettings).toHaveAttribute("aria-expanded", "false");
    await expect(
      createDialog.getByRole("textbox", { name: /发布日期|Published/i }),
    ).toHaveCount(0);
    await advancedSettings.click();
    await expect(
      createDialog.getByRole("textbox", { name: /发布日期|Published/i }),
    ).toBeVisible();
    await titleInput.fill(title);
    await createDialog
      .getByRole("textbox", { name: /Details|说明/i })
      .fill(description);
    await createDialog
      .getByRole("textbox", { name: /Submission due|提交截止/i })
      .fill(dueAt);
    await createDialog
      .getByRole("checkbox", { name: /Major assignment|大作业/i })
      .click();
    await createDialog
      .getByRole("checkbox", { name: /Team required|需要组队/i })
      .click();

    try {
      await page.getByTestId("workspace-homework-create").click();
      const row = page.getByRole("row").filter({ hasText: title }).first();
      await expect(row).toBeVisible({ timeout: 15_000 });

      await page.keyboard.press("Escape");
      await expect(
        page.locator('[data-slot="dialog-content"]').first(),
      ).toHaveCount(0, { timeout: 5_000 });

      await expect(row.getByText(/Major assignment|大作业/i)).toBeVisible();
      await expect(row.getByText(/Team required|需要组队/i)).toBeVisible();

      await expect(row).toContainText(
        /2026-12-31|2026\/12\/31|12月31日|Dec 31/,
      );
      await expect(row).toContainText(/23:59|11:59 PM/);

      await row.getByRole("button", { name: new RegExp(title) }).click();
      const detailDialog = page.locator('[data-slot="dialog-content"]').first();
      await expect(detailDialog).toBeVisible();
      await expect(detailDialog.getByText(description)).toBeVisible();
      await captureStepScreenshot(
        page,
        testInfo,
        "homeworks/created-full-fields",
      );

      homeworkId =
        (await detailDialog.getAttribute("data-homework-id")) ?? undefined;
    } finally {
      await cleanupHomeworksForE2e([homeworkId]);
    }
  });
});
