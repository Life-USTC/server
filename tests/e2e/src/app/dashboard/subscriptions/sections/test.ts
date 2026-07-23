/**
 * E2E tests for the subscriptions dashboard (`/dashboard/subscriptions`)
 *
 * ## Data Represented (subscribed-sections.yml → subscribed-sections-tab.display.fields)
 * - semester group label
 * - subscription.sections[].code
 * - subscription.sections[].course.namePrimary
 * - section.teachers[]
 * - section.credits
 * - Unsubscribe button per section
 * - Calendar subscription URL for iCal feed
 *
 * ## UI/UX Elements
 * - One responsive table per semester with shared column headers
 * - Clicking a row opens details with course navigation and unsubscribe actions
 * - Bulk import dialog (textarea → query section/course codes → confirm dialog)
 * - iCal calendar link copy button
 * - Unsubscribe action: details dialog → destructive confirmation
 * - Empty state with bulk import + browse courses buttons
 *
 * ## Edge Cases
 * - Unauthenticated users see the public dashboard view (subscriptions is auth-only)
 * - Bulk import with invalid codes shows only matched sections in dialog
 * - Calendar link format: /api/users/{userId}:{token}/calendar.ics
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../../utils/auth";
import { DEV_SEED } from "../../../../../utils/dev-seed";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../../utils/page-ready";
import { absoluteTestUrl } from "../../../../../utils/request-url";
import { captureStepScreenshot } from "../../../../../utils/screenshot";
import { resolveSeedSectionMatches } from "../../../../../utils/seed-lookups";
import { ensureSeedSectionSubscription } from "../../../../../utils/subscriptions";

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function openBulkImportDialog(page: import("@playwright/test").Page) {
  const textarea = page.getByRole("textbox", {
    name: /班级或课程代码|Section or course codes|粘贴|Paste/i,
  });
  if ((await textarea.count()) === 0) {
    await page
      .getByRole("button", {
        name: /批量导入班级|Bulk Import Sections/i,
      })
      .first()
      .click();
  }
  await expect(textarea.first()).toBeVisible({ timeout: 5_000 });
  return textarea.first();
}

test.describe("仪表盘关注班级", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([
      {
        name: "NEXT_LOCALE",
        value: "zh-cn",
        url: absoluteTestUrl("/", baseURL),
        sameSite: "Lax",
      },
    ]);
  });

  test("旧版 /dashboard/subscriptions/sections 重定向到关注班级页面", async ({
    page,
  }) => {
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    await gotoAndWaitForReady(page, "/dashboard/subscriptions/sections");

    await expect(page).toHaveURL(/\/dashboard\/subscriptions(?:\?.*)?$/);
  });

  test("未登录旧 subscriptions tab 重定向到语义路径", async ({ page }) => {
    const response = await page.request.get(
      "/?tab=subscriptions&semester=2026-spring",
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(
      "/dashboard/subscriptions?semester=2026-spring",
    );
  });

  test("登录后显示种子班级关注、必填字段和英文单复数文案", async ({
    page,
    baseURL,
  }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    await expect(async () => {
      await ensureSeedSectionSubscription(page);
      await gotoAndWaitForReady(page, "/dashboard/subscriptions");

      await expect(page).toHaveURL(/\/dashboard\/subscriptions(?:\?.*)?$/);
      await expect(page.locator("#main-content")).toBeVisible();

      const subscriptionsContent = page.locator("#main-content").first();
      await expect(
        subscriptionsContent.getByRole("button", {
          name: new RegExp(escapeForRegExp(DEV_SEED.section.code)),
        }),
      ).toBeVisible({ timeout: 3_000 });

      // subscription.sections[].course.namePrimary
      await expect(
        subscriptionsContent
          .locator("td:visible")
          .filter({
            hasText: new RegExp(
              `${escapeForRegExp(DEV_SEED.course.nameCn)}|${escapeForRegExp(DEV_SEED.course.nameEn)}`,
            ),
          })
          .first(),
      ).toBeVisible({ timeout: 3_000 });
      // subscription.sections[].code
      await expect(
        subscriptionsContent.getByText(DEV_SEED.section.code).first(),
      ).toBeVisible({
        timeout: 3_000,
      });
      // section.teachers[] (locale-dependent)
      await expect(
        subscriptionsContent
          .locator("td:visible")
          .filter({
            hasText: new RegExp(
              `${escapeForRegExp(DEV_SEED.teacher.nameCn)}|${escapeForRegExp(DEV_SEED.teacher.nameEn)}`,
            ),
          })
          .first(),
      ).toBeVisible({ timeout: 3_000 });
      // section.credits
      await expect(
        subscriptionsContent
          .getByText(String(DEV_SEED.section.credits))
          .first(),
      ).toBeVisible({ timeout: 3_000 });
      // semester group label — semester name shown as group header
      await expect(page.getByText(DEV_SEED.semesterNameCn).first()).toBeVisible(
        {
          timeout: 3_000,
        },
      );
    }).toPass({
      timeout: 20_000,
      intervals: [500, 1_000, 2_000],
    });

    await captureStepScreenshot(page, testInfo, "subscriptions/seed-fields");
    await page.context().addCookies([
      {
        name: "NEXT_LOCALE",
        value: "en-us",
        url: absoluteTestUrl("/", baseURL),
        sameSite: "Lax",
      },
    ]);
    await gotoAndWaitForReady(page, "/dashboard/subscriptions");

    await expect(
      page.getByText("3 sections included", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("1 section included", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("1 sections included", { exact: true }),
    ).toHaveCount(0);
    await captureStepScreenshot(
      page,
      testInfo,
      "subscriptions/single-section-en-us",
    );
  });

  test("超宽屏按时间倒序分表并渐进增强为瀑布流", async ({ page }, testInfo) => {
    await page.setViewportSize({ height: 1000, width: 1700 });
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/subscriptions");

    const tables = page.locator("#main-content table");
    const semesterGroups = page.getByTestId("subscription-semester-groups");
    const semesterHeadings = semesterGroups.locator(":scope > section h3");
    await expect(tables).toHaveCount(2);
    await expect(semesterGroups).toBeVisible();
    await expect(semesterHeadings.nth(0)).toContainText(
      DEV_SEED.semesterNameCn,
    );
    await expect(semesterHeadings.nth(1)).toContainText(
      DEV_SEED.previousSemesterNameCn,
    );
    expect(
      await semesterGroups.evaluate(
        (element) => getComputedStyle(element).display,
      ),
    ).toBe(
      await page.evaluate(() =>
        CSS.supports("display", "grid-lanes") ? "grid-lanes" : "grid",
      ),
    );
    const firstTable = await tables.nth(0).boundingBox();
    const secondTable = await tables.nth(1).boundingBox();
    expect(firstTable).not.toBeNull();
    expect(secondTable).not.toBeNull();
    expect(secondTable?.x).toBeGreaterThan((firstTable?.x ?? 0) + 100);
    expect(Math.abs((secondTable?.y ?? 0) - (firstTable?.y ?? 0))).toBeLessThan(
      8,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-wide-masonry",
    );
  });

  test("空状态提供发现操作", async ({ page }, testInfo) => {
    test.setTimeout(60000);
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    const clearResponse = await page.request.post(
      "/api/calendar-subscriptions",
      { data: { sectionIds: [] } },
    );
    expect(clearResponse.status()).toBe(200);
    await gotoAndWaitForReady(page, "/dashboard/subscriptions");
    await waitForUiSettled(page);
    await expect(
      page
        .getByRole("button", {
          name: /批量导入班级|Bulk Import Sections/i,
        })
        .first(),
    ).toBeVisible();
    await expect(
      page
        .getByRole("link", {
          name: /浏览班级|Browse Sections/i,
        })
        .first(),
    ).toBeVisible();
    await expect(
      page
        .getByRole("link", {
          name: /浏览课程|Browse Courses/i,
        })
        .first(),
    ).toBeVisible();

    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-empty-state",
    );
  });

  test("移动端订阅列表与操作区不产生页面级横向滚动", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/subscriptions");

    await expect(
      page.getByRole("button", { name: /添加班级|Add Section/i }).first(),
    ).toBeVisible();
    await expect(
      page
        .getByRole("button", {
          name: /批量导入班级|Bulk Import Sections/i,
        })
        .first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-mobile-responsive",
    );
  });

  test("点击关注行打开详情并提供课程主页操作", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/subscriptions");

    await page
      .getByRole("button", {
        name: new RegExp(escapeForRegExp(DEV_SEED.section.code)),
      })
      .click();
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toContainText(DEV_SEED.section.code);
    await expect(
      dialog.getByRole("link", { name: /前往课程主页|Go to Course/i }),
    ).toHaveAttribute("href", /^\/courses\/\d+$/);
    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-section-details",
    );
  });

  test("详情中的取消关注操作进入明确确认弹窗", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/subscriptions");

    await page
      .getByRole("button", {
        name: new RegExp(escapeForRegExp(DEV_SEED.section.code)),
      })
      .click();
    await page
      .getByRole("button", { name: /^(取消关注|Unsubscribe)$/i })
      .click();

    await expect(
      page.getByRole("alertdialog", {
        name: /确认取消关注|Unsubscribe from this section/i,
      }),
    ).toBeVisible();

    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-opt-out-confirm",
    );
  });

  test("复制日历链接生成有效的 iCal URL", async ({ page }, testInfo) => {
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/subscriptions");

    const copyButton = page
      .getByRole("button", { name: /复制日历链接|iCal/i })
      .first();
    await expect(copyButton).toBeVisible();
    await copyButton.click();

    const clipboardText = await page.evaluate(async () =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).toContain("calendar.ics");
    expect(clipboardText).toMatch(/\/api\/users\/[^/]+:[^/]+\/calendar\.ics$/);

    // Verify the calendar endpoint returns valid iCal data
    const calendarResponse = await page.request.get(clipboardText);
    expect(calendarResponse.status()).toBe(200);
    expect(calendarResponse.headers()["content-type"]).toContain(
      "text/calendar",
    );
    const calendarBody = await calendarResponse.text();
    expect(calendarBody).toContain("BEGIN:VCALENDAR");

    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-ical-copied",
    );
  });

  test("批量导入打开确认对话框并可取消", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/dashboard/subscriptions");

    const textarea = await openBulkImportDialog(page);
    await textarea.fill(DEV_SEED.section.code);

    const matchResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/calendar-subscriptions/query") &&
        response.request().method() === "POST" &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: /识别并匹配课程|Match/i }).click();
    await matchResponse;

    const dialog = page
      .getByRole("dialog", { name: /确认关注|Confirm following/i })
      .first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    const matchedSectionCheckbox = dialog
      .getByRole("checkbox", {
        name: new RegExp(
          `选择 ${escapeForRegExp(DEV_SEED.section.code)}|Select ${escapeForRegExp(DEV_SEED.section.code)}`,
          "i",
        ),
      })
      .first();
    await expect(matchedSectionCheckbox).toBeChecked();
    await matchedSectionCheckbox.click();
    await expect(matchedSectionCheckbox).not.toBeChecked();
    await matchedSectionCheckbox.click();
    await expect(matchedSectionCheckbox).toBeChecked();

    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-bulk-import-dialog",
    );

    await dialog.getByRole("button", { name: /取消|Cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("单个添加弹窗可按课程名和教师名搜索并直接关注", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ height: 844, width: 390 });
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    const seedSectionIds = (await resolveSeedSectionMatches(page)).map(
      (section) => section.id,
    );
    await page.request.post("/api/calendar-subscriptions/batch", {
      data: { action: "remove", sectionIds: seedSectionIds },
    });
    await gotoAndWaitForReady(page, "/dashboard/subscriptions");

    await page
      .getByRole("button", { name: /添加班级|Add Section/i })
      .first()
      .click();
    const quickAddDialog = page
      .getByRole("dialog", { name: /添加班级|Add Section/i })
      .first();
    await expect(quickAddDialog).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await quickAddDialog
      .getByRole("textbox", {
        name: /搜索课程或教师|Search courses or teachers/i,
      })
      .fill(DEV_SEED.course.nameCn);

    const matchResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/sections?") &&
        response.request().method() === "GET" &&
        response.status() === 200,
    );
    await quickAddDialog.getByRole("button", { name: /搜索|Search/i }).click();
    await matchResponse;

    await expect(
      quickAddDialog.getByText(DEV_SEED.section.code).first(),
    ).toBeVisible();
    const separator = quickAddDialog.locator(
      '[data-slot="separator"][data-orientation="horizontal"]',
    );
    const resultsLabel = quickAddDialog.getByText(
      /找到 \d+ 个教学班|Found \d+ sections?/i,
    );
    const hint = quickAddDialog.getByText(
      /搜索范围仅限所选学期|Search is limited to the selected semester/i,
    );
    const [separatorBox, resultsLabelBox, hintBox] = await Promise.all([
      separator.boundingBox(),
      resultsLabel.boundingBox(),
      hint.boundingBox(),
    ]);
    expect(separatorBox).not.toBeNull();
    expect(resultsLabelBox).not.toBeNull();
    expect(hintBox).not.toBeNull();
    expect(
      (separatorBox?.y ?? 0) - ((hintBox?.y ?? 0) + (hintBox?.height ?? 0)),
    ).toBeLessThan(24);
    expect(
      (resultsLabelBox?.y ?? 0) -
        ((separatorBox?.y ?? 0) + (separatorBox?.height ?? 0)),
    ).toBeLessThan(24);
    await quickAddDialog
      .getByRole("textbox", {
        name: /搜索课程或教师|Search courses or teachers/i,
      })
      .fill(DEV_SEED.teacher.nameCn);
    const teacherResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/sections?") &&
        response.url().includes(encodeURIComponent(DEV_SEED.teacher.nameCn)) &&
        response.status() === 200,
    );
    await quickAddDialog.getByRole("button", { name: /搜索|Search/i }).click();
    await teacherResponse;
    await expect(
      quickAddDialog.getByText(DEV_SEED.section.code).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: /确认关注|Confirm following/i }),
    ).toHaveCount(0);

    const sectionCheckbox = quickAddDialog.getByRole("checkbox", {
      name: new RegExp(escapeForRegExp(DEV_SEED.section.code), "i"),
    });
    await expect(sectionCheckbox).toBeChecked();
    await sectionCheckbox.click();
    await expect(sectionCheckbox).not.toBeChecked();
    await sectionCheckbox.click();
    await expect(sectionCheckbox).toBeChecked();

    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-quick-add-results",
    );

    const subscribeResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/calendar-subscriptions/batch") &&
        response.request().method() === "POST" &&
        response.status() === 200,
    );
    await quickAddDialog
      .getByRole("button", {
        name: /关注所选|Follow selected/i,
      })
      .click();
    await subscribeResponse;
    await expect(quickAddDialog).not.toBeVisible();
  });

  test("单个添加弹窗在无匹配结果时保留搜索上下文", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await signInAsDebugUser(page, "/dashboard/subscriptions");
    await gotoAndWaitForReady(page, "/dashboard/subscriptions");

    await page
      .getByRole("button", { name: /添加班级|Add Section/i })
      .first()
      .click();
    const quickAddDialog = page
      .getByRole("dialog", { name: /添加班级|Add Section/i })
      .first();
    await quickAddDialog
      .getByRole("textbox", {
        name: /搜索课程或教师|Search courses or teachers/i,
      })
      .fill("DEVXX000.99");

    const matchResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/sections?") &&
        response.request().method() === "GET" &&
        response.status() === 200,
    );
    await quickAddDialog.getByRole("button", { name: /搜索|Search/i }).click();
    await matchResponse;

    await expect(
      quickAddDialog.getByText(/没有找到教学班|No sections found/i),
    ).toBeVisible();
    await expect(
      quickAddDialog.getByRole("button", {
        name: /关注所选|Follow selected/i,
      }),
    ).toBeDisabled();
    await expect(
      quickAddDialog.getByRole("textbox", {
        name: /搜索课程或教师|Search courses or teachers/i,
      }),
    ).toHaveValue("DEVXX000.99");

    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-quick-add-empty",
    );
  });

  test("批量导入可确认并显示成功", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/dashboard/subscriptions");

    const textarea = await openBulkImportDialog(page);
    // Include a valid code and an invalid one
    await textarea.fill(`\n${DEV_SEED.section.code}\nDEVXX000.99\n`);

    const matchResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/calendar-subscriptions/query") &&
        response.request().method() === "POST" &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: /识别并匹配课程|Match/i }).click();
    await matchResponse;

    const dialog = page
      .getByRole("dialog", { name: /确认关注|Confirm following/i })
      .first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText(DEV_SEED.section.code).first()).toBeVisible();

    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-bulk-import-ready",
    );

    await dialog
      .getByRole("button", {
        name: /关注已选的 \d+ 个班级|关注已选|Follow \d+ sections|Follow/i,
      })
      .click();

    await expect(
      page
        .getByText(
          /已新增关注 \d+ 个班级|Added \d+ new sections? to Life@USTC/i,
        )
        .first(),
    ).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard-subscriptions-bulk-import-success",
    );
  });
});
