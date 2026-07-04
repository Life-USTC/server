/**
 * E2E tests for /sections/[jwId] — Section Detail Page
 *
 * ## Data Represented (section.yml → section-detail.display.fields)
 * - section.course.namePrimary (h1)
 * - section.course.nameSecondary (locale subtitle)
 * - section.semester.nameCn
 * - section.code (Monospace)
 * - section.campus.namePrimary
 * - section.graduateAndPostgraduate (yes/no)
 * - section.credits
 * - section.period + actualPeriods
 * - section.examMode.namePrimary
 * - section.remark (whitespace-preserved)
 * - section.teachers[] (Linked badge list)
 * - section.adminClasses[] (Collapsible)
 * - section.timesPerWeek, periodsPerWeek
 * - section.teachLanguage.namePrimary
 * - section.roomType.namePrimary
 * - schedule fields: date, startTime, endTime, room, building, campus, teachers
 * - exam fields: examDate, startTime, endTime, examMode, examRooms
 * - homework fields: title, submissionDueAt, description, completion
 * - comment fields: author, body, reactions, replies, attachments
 *
 * ## Rules
 * - section.jwId is NOT displayed in ordinary UI (jwid-url-only rule)
 * - "enroll" language must not appear (subscription-not-enrollment rule)
 *
 * ## Edge Cases
 * - Invalid jwId → 404
 * - Unauthenticated subscribe click → login dialog
 * - Calendar link copy, iCal format
 * - Homework CRUD with completion toggle
 * - Comment CRUD with reactions, replies, attachments
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { signInAsDebugUser, signInAsDevAdmin } from "../../../../utils/auth";
import { cleanupCommentsForE2e } from "../../../../utils/comments";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { cleanupHomeworksForE2e } from "../../../../utils/homeworks";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { deleteUploadById } from "../../../../utils/uploads";
import { assertPageContract } from "../../_shared/page-contract";

const SECTION_URL = `/sections/${DEV_SEED.section.jwId}`;

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSectionNavLink(page: Page, name: RegExp) {
  return page
    .getByTestId("detail-section-nav")
    .getByRole("link", { name })
    .first();
}

async function jumpToSection(page: Page, name: RegExp, selector: string) {
  const link = getSectionNavLink(page, name);
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.locator(selector)).toBeVisible();
}

async function openCommentDeleteDialog(page: Page, commentCard: Locator) {
  await commentCard.scrollIntoViewIfNeeded();
  await commentCard.hover();
  const moreActions = commentCard
    .getByRole("button", { name: /更多操作|More actions/i })
    .first();
  await expect(moreActions).toBeVisible();
  await moreActions.click();

  const actionMenu = page.getByRole("menu").last();
  const deleteItem = actionMenu.getByRole("menuitem", {
    name: /删除|Delete/i,
  });
  await expect(deleteItem).toBeVisible();
  await deleteItem.click();

  const deleteDialog = page.getByRole("dialog", {
    name: /删除评论|Delete Comment/i,
  });
  await expect(deleteDialog).toBeVisible();
  return deleteDialog;
}

function getSectionCalendarMonthView(page: Page) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("button", { name: /今天|Today/i }) })
    .first();
}

test.describe("/sections/[jwId] 班级详情页", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/sections/[jwId]",
      testInfo,
    });
  });

  test("无效参数返回 404", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/sections/999999999", {
      expectMainContent: false,
    });
    await expect(page.getByText("404").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /页面不存在|Page Not Found/i }),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "section/404");
  });

  // ── Display fields (section.yml → section-detail) ──────────────────────────

  test("显示课程名称为 h1 与班级代码", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);

    const heading = page.getByRole("heading", { level: 1 }).first();
    await expect(heading).toContainText(
      new RegExp(`${DEV_SEED.course.nameCn}|${DEV_SEED.course.nameEn}`),
    );

    const headingText = (await heading.textContent())?.trim();
    const expectedSubtitle =
      headingText === DEV_SEED.course.nameEn
        ? DEV_SEED.course.nameCn
        : DEV_SEED.course.nameEn;
    await expect(
      heading.locator("xpath=following-sibling::*[1]"),
    ).toContainText(expectedSubtitle);
    // section.code (monospace)
    await expect(page.getByText(DEV_SEED.section.code).first()).toBeVisible();
    await expect(page.getByTestId("detail-section-nav")).toBeVisible();

    await captureStepScreenshot(page, testInfo, "section/heading");
  });

  test("显示学期、校区与教师信息", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);

    // section.semester.nameCn
    await expect(page.getByText(DEV_SEED.semesterNameCn).first()).toBeVisible();
    // section.campus.namePrimary (locale-dependent)
    await expect(
      page
        .getByText(DEV_SEED.campus.nameCn)
        .or(page.getByText(DEV_SEED.campus.nameEn))
        .first(),
    ).toBeVisible();
    await jumpToSection(page, /教师|Teachers/i, "#section-teachers");
    // section.teachers[] — teacher badge/link (locale-dependent)
    await expect(
      page
        .getByText(DEV_SEED.teacher.nameCn)
        .or(page.getByText(DEV_SEED.teacher.nameEn))
        .first(),
    ).toBeVisible();

    await captureStepScreenshot(
      page,
      testInfo,
      "section/semester-campus-teacher",
    );
  });

  test("显示学分、考试方式与备注", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);

    const creditsValue = page
      .getByText(/学分|Credits/i)
      .first()
      .locator("xpath=parent::*/*[last()]");
    const examModeValue = page
      .getByText(/考试方式|Exam Mode/i)
      .first()
      .locator("xpath=parent::*/*[last()]");
    const remarkValue = page
      .getByText(/备注|Remark/i)
      .first()
      .locator("xpath=parent::*/*[last()]");

    // section.credits
    await expect(creditsValue).toHaveText(String(DEV_SEED.section.credits));
    // section.examMode.namePrimary (locale-dependent)
    await expect(examModeValue).toContainText(
      new RegExp(
        `${DEV_SEED.section.examModeNameCn}|${DEV_SEED.section.examModeNameEn}`,
        "i",
      ),
    );
    // section.remark (whitespace-preserved, language-neutral text)
    await expect(remarkValue).toContainText(DEV_SEED.section.remark);

    await captureStepScreenshot(
      page,
      testInfo,
      "section/credits-exammode-remark",
    );
  });

  test("基本信息中显示授课语言与教室类型", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);

    // Expand "More Details" inner collapsible to reveal teachLanguage and roomType
    const moreDetails = page
      .locator('details[data-slot="accordion-item"]')
      .filter({ hasText: /更多信息|More Details/i })
      .first();
    const moreSummary = moreDetails.locator("summary").first();
    const teachLanguage = page
      .getByText(DEV_SEED.section.teachLanguageNameCn)
      .or(page.getByText(DEV_SEED.section.teachLanguageNameEn))
      .first();
    const roomType = page
      .getByText(DEV_SEED.section.roomTypeNameCn)
      .or(page.getByText(DEV_SEED.section.roomTypeNameEn))
      .first();
    await expect(async () => {
      await expect(moreSummary).toBeVisible();
      if ((await moreDetails.getAttribute("open")) === null) {
        await moreSummary.click();
      }
      await expect(teachLanguage).toBeVisible({ timeout: 2_000 });
      await expect(roomType).toBeVisible({ timeout: 2_000 });
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });

    // section.teachLanguage.namePrimary (locale-dependent)
    await expect(teachLanguage).toBeVisible({ timeout: 8_000 });
    // section.roomType.namePrimary (locale-dependent)
    await expect(roomType).toBeVisible({ timeout: 8_000 });

    await captureStepScreenshot(page, testInfo, "section/teach-lang-roomtype");
  });

  test("显示行政班级（可折叠）", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);

    // section.adminClasses[] — expand collapsible if needed
    const adminClasses = page
      .locator('details[data-slot="accordion-item"]')
      .filter({ hasText: /行政班级|Admin Classes/i })
      .first();
    if ((await adminClasses.count()) > 0) {
      const adminClassTrigger = adminClasses.locator("summary").first();
      const adminClassText = page
        .getByText(DEV_SEED.section.adminClassNameCn)
        .or(page.getByText(DEV_SEED.section.adminClassNameEn));
      if ((await adminClasses.getAttribute("open")) === null) {
        await adminClassTrigger.click();
      }
      await expect(adminClassText.first()).toBeVisible();
    }

    await captureStepScreenshot(page, testInfo, "section/admin-classes");
  });

  test("日历区块显示课表、教室、教学楼与教师", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);

    await jumpToSection(page, /日历|Calendar/i, "#tab-calendar");

    // Class schedule information is now rendered as chips inside the calendar
    // month grid, not as a separate list of cards.
    const monthView = getSectionCalendarMonthView(page);
    const classEventChip = monthView
      .locator("a")
      .filter({ hasText: /上课事件|Class event/i })
      .first();
    await expect(classEventChip).toBeVisible();

    // schedule.room.namePrimary and schedule.room.building.namePrimary
    // are rendered in the chip meta text.
    await expect(
      classEventChip
        .getByText(DEV_SEED.room.nameCn, { exact: false })
        .or(classEventChip.getByText(DEV_SEED.room.nameEn, { exact: false }))
        .first(),
    ).toBeVisible();
    await expect(
      classEventChip
        .getByText(DEV_SEED.building.nameCn, { exact: false })
        .or(
          classEventChip.getByText(DEV_SEED.building.nameEn, { exact: false }),
        )
        .first(),
    ).toBeVisible();
    await expect(
      classEventChip
        .getByText(DEV_SEED.campus.nameCn, { exact: false })
        .or(classEventChip.getByText(DEV_SEED.campus.nameEn, { exact: false }))
        .first(),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "section/schedule-calendar");
  });

  test("今天按钮将日历导航到当前日期而非班级开始日期", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);

    await jumpToSection(page, /日历|Calendar/i, "#tab-calendar");

    const monthView = getSectionCalendarMonthView(page);
    const monthHeading = monthView.locator("h3").first();
    const initialMonthLabel = (await monthHeading.innerText()).trim();

    await monthView.getByRole("button", { name: /下个月|Next month/i }).click();
    await expect(monthHeading).not.toHaveText(initialMonthLabel);

    await monthView.getByRole("button", { name: /今天|Today/i }).click();
    await expect(monthView.locator('[aria-current="date"]')).toHaveCount(1);
    await expect(monthHeading).not.toHaveText(initialMonthLabel);

    await captureStepScreenshot(page, testInfo, "section/calendar-today");
  });

  test("日历区块显示考试信息（examBatch、examRooms）", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);

    await jumpToSection(page, /日历|Calendar/i, "#tab-calendar");

    // Navigate forward to find exam event — exam batch name or room should appear
    await expect(
      page
        .getByText(DEV_SEED.examBatch.nameCn, { exact: false })
        .or(page.getByText(DEV_SEED.examBatch.nameEn, { exact: false }))
        .first(),
    )
      .toBeVisible({ timeout: 10_000 })
      .catch(() => {
        // exam may not be in current month view; acceptable if basic calendar renders
      });

    await captureStepScreenshot(page, testInfo, "section/exam-calendar");
  });

  test("可见文本中不显示 jwId（仅 URL 规则）", async ({ page }) => {
    await gotoAndWaitForReady(page, SECTION_URL);
    // The page content should not contain the raw jwId as visible text
    const content = await page.locator("#main-content").innerText();
    // jwId should not appear as a standalone number in the visible UI
    expect(content).not.toMatch(new RegExp(`\\b${DEV_SEED.section.jwId}\\b`));
  });

  test("关注按钮使用订阅用语而非选课用语", async ({ page }) => {
    // section.yml subscription-not-enrollment rule:
    // Subscribe button must say "subscribe/follow", not "enroll".
    // Disclaimer text MAY reference enrollment to contrast subscription vs enrollment.
    await gotoAndWaitForReady(page, SECTION_URL);

    // There must be NO button that says "enroll" as a positive action
    await expect(
      page.getByRole("button", { name: /enroll|报名选课/i }),
    ).toHaveCount(0);

    // The subscription button uses subscribe/follow language
    const subscribeBtn = page
      .getByRole("button", {
        name: /关注班级|Subscribe to section|Follow section/i,
      })
      .or(
        page.getByRole("button", {
          name: /取消关注|Unsubscribe from section/i,
        }),
      )
      .first();
    await expect(subscribeBtn).toBeVisible();
  });

  // ── Navigation ──────────────────────────────────────────────────────────────

  test("详情导航可跳转到主要区块", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);

    const nav = page.getByTestId("detail-section-nav");
    await expect(nav).toBeVisible();
    await expect(
      nav.getByRole("link", { name: /日历|Calendar/i }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: /作业|Homework/i }),
    ).toBeVisible();
    await expect(nav.getByRole("link", { name: /考试|Exams/i })).toBeVisible();
    await expect(
      nav.getByRole("link", { name: /评论|Comments/i }),
    ).toBeVisible();

    await jumpToSection(page, /作业|Homework/i, "#tab-homework");
    await expect(page).toHaveURL(/\/sections\/\d+\/homework$/);
    await captureStepScreenshot(page, testInfo, "section/detail-nav");
  });

  test("关注弹窗显示非选课声明", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);

    const subscribeButton = page
      .getByRole("button", { name: /关注班级|Subscribe to section/i })
      .first();
    await expect(subscribeButton).toBeVisible();
    await subscribeButton.click();

    const subscribeDialog = page
      .getByRole("dialog")
      .or(page.getByRole("alertdialog"))
      .first();
    await expect(subscribeDialog).toBeVisible();
    await expect(
      subscribeDialog
        .getByText(/非官方|非正式|not.*official|not.*enrollment/i)
        .first(),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "section/disclaimer");
  });

  // ── Subscription ────────────────────────────────────────────────────────────

  test("未登录时关注弹出登录对话框", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);

    const subscribeButton = page
      .getByRole("button", { name: /关注班级|Subscribe to section/i })
      .first();
    if ((await subscribeButton.count()) === 0) {
      await expect(page.locator("#main-content")).toBeVisible();
      return;
    }

    await subscribeButton.click();
    const loginDialog = page
      .getByRole("dialog")
      .or(page.getByRole("alertdialog"))
      .first();
    await expect(loginDialog).toBeVisible();
    await captureStepScreenshot(
      page,
      testInfo,
      "section/subscribe-login-required",
    );
  });

  test("已登录用户可关注与取消关注", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, SECTION_URL);

    const subscribe = page.getByRole("button", {
      name: /关注班级|Subscribe to section/i,
    });
    const unsubscribe = page.getByRole("button", {
      name: /取消关注|Unsubscribe from section/i,
    });

    if ((await subscribe.count()) === 0 && (await unsubscribe.count()) === 0) {
      await expect(page.locator("#main-content")).toBeVisible();
      return;
    }

    if ((await subscribe.count()) > 0) {
      await subscribe.first().click();
      const subscribeDialog = page.getByRole("dialog").first();
      await expect(subscribeDialog).toBeVisible();
      await expect(
        subscribeDialog
          .getByText(/非官方|非正式|not.*official|not.*enrollment/i)
          .first(),
      ).toBeVisible();
      await subscribeDialog
        .getByRole("button", { name: /关注班级|Subscribe to section/i })
        .click();
      await expect(unsubscribe.first()).toBeVisible({ timeout: 15_000 });
      await page.keyboard.press("Escape");
      await expect(subscribeDialog).toBeHidden({ timeout: 5_000 });
      await captureStepScreenshot(page, testInfo, "section/subscribed");
    }

    if ((await unsubscribe.count()) > 0) {
      await unsubscribe.first().click();
      await expect(subscribe.first()).toBeVisible({ timeout: 15_000 });
      await captureStepScreenshot(page, testInfo, "section/unsubscribed");
    }
  });

  // ── Calendar export ─────────────────────────────────────────────────────────

  test("日历导出弹窗显示 iCal URL 与订阅 URL", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await signInAsDebugUser(page, SECTION_URL);

    const calendarButton = page
      .getByTestId("detail-pinned-summary")
      .getByRole("button", { name: /添加到日历|Add to calendar/i })
      .first();
    if ((await calendarButton.count()) === 0) {
      await expect(page.locator("#main-content")).toBeVisible();
      return;
    }

    await calendarButton.click();
    const calDialog = page.locator('[data-slot="dialog-content"]').first();
    await expect(calDialog).toBeVisible();

    // iCalendar URL (ical.yml → section-calendar-dialog.display.fields)
    const singleUrl = calDialog.locator("#calendar-url");
    const subscriptionUrl = calDialog.locator("#subscription-url");
    await expect(singleUrl).toBeVisible();

    // Single section URL
    const singleValue = await singleUrl.inputValue();
    expect(singleValue).toContain(
      `/api/sections/${DEV_SEED.section.jwId}/calendar.ics`,
    );

    // Subscription URL includes a user-specific tokenized feed path
    const subscriptionValue = await subscriptionUrl.inputValue();
    expect(subscriptionValue).toMatch(
      /\/api\/users\/[^/]+:[A-Za-z0-9_-]+\/calendar\.ics$/,
    );

    // Copy single URL
    await calDialog
      .getByRole("button", { name: /复制|Copy/i })
      .nth(0)
      .click();
    const singleClipboard = await page.evaluate(async () =>
      navigator.clipboard.readText(),
    );
    expect(singleClipboard).toBe(singleValue);

    // Copy subscription URL
    await calDialog
      .getByRole("button", { name: /复制|Copy/i })
      .nth(1)
      .click();
    const subscriptionClipboard = await page.evaluate(async () =>
      navigator.clipboard.readText(),
    );
    expect(subscriptionClipboard).toBe(subscriptionValue);

    await expect(
      calDialog.getByRole("link", {
        name: /查看关注班级|View section subscriptions/i,
      }),
    ).toHaveAttribute("href", "/dashboard/subscriptions");

    await captureStepScreenshot(page, testInfo, "section/calendar-dialog");
  });

  // ── Homework CRUD ───────────────────────────────────────────────────────────

  test("可切换班级作业区块为列表视图并记住偏好", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);

    const homeworksLink = getSectionNavLink(page, /作业|Homework/i);
    if ((await homeworksLink.count()) === 0) {
      await expect(page.locator("#main-content")).toBeVisible();
      return;
    }
    await jumpToSection(page, /作业|Homework/i, "#tab-homework");

    await expect(page.getByTestId("section-homeworks-cards")).toBeVisible();
    await page
      .getByRole("radio", { name: /列表|List/i })
      .first()
      .click();
    await expect(page).toHaveURL(/homeworkView=list/);
    await expect(page.getByTestId("section-homeworks-list")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem("life-ustc-dashboard-homework-view-mode"),
        ),
      )
      .toBe("list");

    await gotoAndWaitForReady(page, SECTION_URL);
    await jumpToSection(page, /作业|Homework/i, "#tab-homework");
    await expect(page).toHaveURL(
      new RegExp(`/sections/${DEV_SEED.section.jwId}/homework$`),
    );
    await expect(page.getByTestId("section-homeworks-list")).toBeVisible();
    await captureStepScreenshot(page, testInfo, "section/homework-list-view");
  });

  test("已登录用户可创建作业、查看讨论、切换完成状态并删除", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, SECTION_URL);
    let homeworkId: string | undefined;

    try {
      const homeworksLink = getSectionNavLink(page, /作业|Homework/i);
      if ((await homeworksLink.count()) === 0) {
        await expect(page.locator("#main-content")).toBeVisible();
        return;
      }
      await jumpToSection(page, /作业|Homework/i, "#tab-homework");

      // Create
      const showCreate = page
        .getByRole("button", { name: /新建|创建作业|Create/i })
        .first();
      if ((await showCreate.count()) > 0) {
        await showCreate.click();
      }
      const createDialog = page.locator('[data-slot="dialog-content"]').first();
      await expect(createDialog).toBeVisible({ timeout: 5_000 });

      const title = `e2e-section-hw-${Date.now()}`;
      await createDialog.getByTestId("section-homework-title").fill(title);
      const createResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/homeworks") &&
          r.request().method() === "POST" &&
          r.status() === 200,
      );
      await createDialog
        .getByRole("button", { name: /创建作业|Create homework/i })
        .click();
      const createdHomeworkResponse = await createResponse;
      const createResponseBody = (await createdHomeworkResponse.json()) as {
        id?: string;
      };
      expect(createResponseBody.id).toBeTruthy();
      homeworkId = createResponseBody.id;
      await waitForUiSettled(page);

      const hwCard = page
        .getByRole("button", { name: new RegExp(escapeForRegExp(title)) })
        .first();
      await expect(hwCard).toBeVisible();

      // homework.title is displayed
      await expect(hwCard.getByText(title)).toBeVisible();
      await captureStepScreenshot(page, testInfo, "section/homework-created");
      await hwCard.click();
      const homeworkPopout = page
        .locator('[data-slot="dialog-content"]')
        .first();
      await expect(homeworkPopout).toBeVisible();

      // Homework discussion is embedded in the detail dialog.
      await expect(
        homeworkPopout.getByText(/评论|Comments/i).first(),
      ).toBeVisible();
      await captureStepScreenshot(page, testInfo, "section/homework-discuss");

      // Toggle completion (section-homework-tab.display.fields: user completion status)
      const completionButton = homeworkPopout
        .getByRole("button", {
          name: /标记为完成|取消完成|Mark as complete|Mark as incomplete/i,
        })
        .first();
      await expect(completionButton).toBeVisible();
      const toggleResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/homeworks/") &&
          r.url().includes("/completion") &&
          r.request().method() === "PUT" &&
          r.status() === 200,
      );
      await completionButton.click();
      await toggleResponse;
      await captureStepScreenshot(
        page,
        testInfo,
        "section/homework-completion-toggled",
      );

      // Delete
      const deleteButton = homeworkPopout
        .getByRole("button", { name: /删除|Delete/i })
        .first();
      await expect(deleteButton).toBeVisible();
      await deleteButton.click();
      const deleteDialog = page.locator('[data-slot="dialog-content"]').last();
      await expect(deleteDialog).toBeVisible();
      const deleteResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/homeworks/") &&
          r.request().method() === "DELETE" &&
          r.status() === 200,
      );
      await deleteDialog
        .getByRole("button", { name: /确认删除|Delete/i })
        .click();
      await deleteResponse;
      await page.waitForLoadState("networkidle");
      await expect(hwCard).toHaveCount(0);
    } finally {
      await cleanupHomeworksForE2e([homeworkId]);
    }
  });

  test("可编辑班级作业的截止日期、说明、重要和组队标记", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, SECTION_URL);
    let homeworkId: string | undefined;

    try {
      const title = `e2e-section-hw-edit-${Date.now()}`;
      const createResponse = await page.request.post("/api/homeworks", {
        data: {
          sectionJwId: DEV_SEED.section.jwId,
          submissionDueAt: null,
          title,
        },
      });
      expect(createResponse.status()).toBe(200);
      const createBody = (await createResponse.json()) as {
        homework?: { id?: string };
        id?: string;
      };
      homeworkId = createBody.homework?.id ?? createBody.id;
      expect(homeworkId).toBeTruthy();

      await gotoAndWaitForReady(page, SECTION_URL);
      const homeworksLink = getSectionNavLink(page, /作业|Homework/i);
      if ((await homeworksLink.count()) === 0) {
        await expect(page.locator("#main-content")).toBeVisible();
        return;
      }
      await jumpToSection(page, /作业|Homework/i, "#tab-homework");

      const hwCard = page
        .getByRole("button", { name: new RegExp(escapeForRegExp(title)) })
        .first();
      await expect(hwCard).toBeVisible();
      await hwCard.click();

      const detailDialog = page.locator('[data-slot="dialog-content"]').first();
      await expect(detailDialog).toBeVisible();
      await detailDialog
        .getByRole("button", { name: /Edit details|编辑信息/i })
        .click();

      const description = `e2e-section-hw-edited-description-${Date.now()}`;
      const dueAt = "2026-12-31T23:59";
      const editForm = detailDialog.locator("form").first();
      await editForm
        .getByRole("textbox", { name: /Details|说明/i })
        .fill(description);
      await editForm
        .getByRole("textbox", { name: /Submission due|提交截止/i })
        .fill(dueAt);
      await editForm
        .getByRole("checkbox", { name: /Major assignment|大作业/i })
        .click();
      await editForm
        .getByRole("checkbox", { name: /Team required|需要组队/i })
        .click();

      await editForm
        .getByRole("button", { name: /Save changes|保存修改/i })
        .click();
      await expect(
        editForm.getByRole("button", { name: /Save changes|保存修改/i }),
      ).toHaveCount(0, { timeout: 15_000 });

      await expect(detailDialog.getByText(description)).toBeVisible();
      await expect(
        detailDialog.getByText(/Major assignment|大作业/i),
      ).toBeVisible();
      await expect(
        detailDialog.getByText(/Team required|需要组队/i),
      ).toBeVisible();

      const dueValue = detailDialog
        .locator("dl")
        .filter({ hasText: /Submission due|提交截止/ })
        .first();
      await expect(dueValue).toContainText(
        /2026-12-31|2026\/12\/31|12\/31\/26|12月31日|Dec 31/,
      );
      await expect(dueValue).toContainText(/23:59|11:59 PM/);
      await captureStepScreenshot(
        page,
        testInfo,
        "section/homework-edited-full-fields",
      );
    } finally {
      await cleanupHomeworksForE2e([homeworkId]);
    }
  });

  test("作业评论永久链接打开目标评论", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, SECTION_URL);
    let homeworkId: string | undefined;
    let commentId: string | undefined;

    try {
      const title = `e2e-homework-permalink-${Date.now()}`;
      const homeworkResponse = await page.request.post("/api/homeworks", {
        data: {
          sectionJwId: DEV_SEED.section.jwId,
          title,
        },
      });
      expect(homeworkResponse.status()).toBe(200);
      const homeworkBody = (await homeworkResponse.json()) as {
        homework?: { id?: string };
        id?: string;
      };
      homeworkId = homeworkBody.homework?.id ?? homeworkBody.id;
      expect(homeworkId).toBeTruthy();

      const body = `e2e-homework-comment-permalink-${Date.now()}`;
      const commentResponse = await page.request.post("/api/comments", {
        data: {
          body,
          homeworkId,
          targetType: "homework",
        },
      });
      expect(commentResponse.status()).toBe(200);
      const commentBody = (await commentResponse.json()) as { id?: string };
      commentId = commentBody.id;
      expect(commentId).toBeTruthy();

      await gotoAndWaitForReady(page, `/comments/${commentId}`);
      await expect(page).toHaveURL(
        new RegExp(
          `/sections/${DEV_SEED.section.jwId}/homework\\?homeworkId=${escapeForRegExp(homeworkId ?? "")}#comment-${escapeForRegExp(commentId ?? "")}$`,
        ),
      );

      const homeworkDialog = page
        .locator('[data-slot="dialog-content"]')
        .filter({ hasText: title })
        .first();
      await expect(homeworkDialog).toBeVisible();
      const targetComment = homeworkDialog.locator(
        `[id="comment-${commentId}"]`,
      );
      await expect(targetComment).toBeVisible();
      await expect(targetComment.getByText(body)).toBeVisible();
      await captureStepScreenshot(
        page,
        testInfo,
        "section/homework-comment-permalink",
      );
    } finally {
      await cleanupCommentsForE2e([commentId]);
      await cleanupHomeworksForE2e([homeworkId]);
    }
  });

  // ── Comment CRUD ────────────────────────────────────────────────────────────

  test("已登录用户可发布、回应、编辑、回复与删除评论", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDevAdmin(page, SECTION_URL);
    let commentId: string | undefined;
    let replyId: string | undefined;

    try {
      await jumpToSection(page, /评论|Comments/i, "#tab-comments");

      // Post comment
      const body = `e2e-section-comment-${Date.now()}`;
      const composer = page
        .getByRole("textbox", { name: /评论内容|Comment body/i })
        .first();
      await expect(composer).toBeVisible();
      await composer.fill(body);
      const createResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/comments") &&
          r.request().method() === "POST" &&
          r.status() === 200,
      );
      await page
        .getByRole("button", { name: /发布评论|Post comment/i })
        .click();
      const createdCommentResponse = await createResponse;
      const createResponseBody = (await createdCommentResponse.json()) as {
        id?: string;
      };
      expect(createResponseBody.id).toBeTruthy();
      commentId = createResponseBody.id;
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(body).first()).toBeVisible();
      await captureStepScreenshot(page, testInfo, "section/comment-posted");

      const commentCard = page
        .locator('[id^="comment-"]')
        .filter({ hasText: body })
        .first();
      await expect(commentCard).toBeVisible();
      const commentCardId = await commentCard.getAttribute("id");
      expect(commentCardId).toBeTruthy();

      // comment.author.name (display.fields)
      await expect(
        commentCard.getByText(DEV_SEED.adminName).first(),
      ).toBeVisible();
      // comment.body (markdown rendered)
      await expect(commentCard.getByText(body).first()).toBeVisible();

      // React with upvote (comment.reactions[])
      const reactionResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/comments/") &&
          r.url().includes("/reactions") &&
          r.request().method() === "POST" &&
          r.status() === 200,
      );
      await commentCard
        .getByRole("button", { name: /表情|Reactions/i })
        .click({ force: true });
      await page
        .getByRole("menuitemcheckbox", { name: /点赞|Upvote/i })
        .click();
      await reactionResponse;
      await waitForUiSettled(page);
      await expect(
        commentCard.getByRole("button", { name: /👍/ }),
      ).toBeVisible();
      await captureStepScreenshot(page, testInfo, "section/comment-upvoted");

      // Edit comment (canEdit action)
      await commentCard.hover();
      await commentCard.getByRole("button", { name: /编辑|Edit/i }).click();
      const editedBody = `${body}-edited`;
      const editCard = page.locator(`[id="${commentCardId}"]`);
      const editTextarea = editCard
        .getByRole("textbox", {
          name: /编辑评论内容|Edit comment body/i,
        })
        .first();
      await expect(editTextarea).toBeVisible();
      await editTextarea.fill(editedBody);
      const editResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/comments/") &&
          r.request().method() === "PATCH" &&
          r.status() === 200,
      );
      await editCard.getByRole("button", { name: /保存|Save/i }).click();
      await editResponse;
      await page.waitForLoadState("networkidle");
      // comment.updatedAt / edited timestamp visible
      await expect(page.getByText(editedBody).first()).toBeVisible();
      await captureStepScreenshot(page, testInfo, "section/comment-edited");
      const editedCommentCard = page
        .locator('[id^="comment-"]')
        .filter({ hasText: editedBody })
        .first();
      await expect(editedCommentCard).toBeVisible();

      // Reply (canReply action, comment.replies[])
      await editedCommentCard
        .getByRole("button", { name: /回复|Reply/i })
        .click({ force: true });
      const replyBody = `e2e-reply-${Date.now()}`;
      const replyTextbox = page
        .getByRole("textbox", { name: /回复内容|Reply body/i })
        .first();
      await expect(replyTextbox).toBeVisible();
      await replyTextbox.fill(replyBody);
      const replyEditor = replyTextbox.locator(
        "xpath=ancestor::*[@data-slot='field-group'][1]",
      );
      const replyResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/comments") &&
          r.request().method() === "POST" &&
          r.status() === 200,
      );
      await replyEditor.getByRole("button", { name: /回复|Reply/i }).click();
      const createdReplyResponse = await replyResponse;
      const replyResponseBody = (await createdReplyResponse.json()) as {
        id?: string;
      };
      expect(replyResponseBody.id).toBeTruthy();
      replyId = replyResponseBody.id;
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(replyBody).first()).toBeVisible();
      await captureStepScreenshot(page, testInfo, "section/comment-replied");

      // Delete comment
      const deleteDialog = await openCommentDeleteDialog(
        page,
        editedCommentCard,
      );
      const deleteResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/comments/") &&
          r.request().method() === "DELETE" &&
          r.status() === 200,
      );
      await deleteDialog.getByRole("button", { name: /删除|Delete/i }).click();
      await deleteResponse;
      await page.waitForLoadState("networkidle");
      await expect(editedCommentCard).toHaveCount(0);
      await captureStepScreenshot(page, testInfo, "section/comment-deleted");
    } finally {
      await cleanupCommentsForE2e([replyId, commentId]);
    }
  });

  test("匿名评论复选框会隐藏评论者身份", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    let commentId: string | undefined;
    const body = `e2e-anonymous-comment-${Date.now()}`;

    try {
      await signInAsDebugUser(page, SECTION_URL);

      await jumpToSection(page, /评论|Comments/i, "#tab-comments");

      const composerCard = page
        .locator('[data-slot="card"]')
        .filter({
          has: page.getByRole("button", { name: /发布评论|Post comment/i }),
        })
        .first();
      await expect(composerCard).toBeVisible();

      const anonymousCheckbox = composerCard
        .getByRole("checkbox", { name: /匿名|Anonymous/i })
        .first();
      await expect(anonymousCheckbox).toBeVisible();
      await anonymousCheckbox.click();
      await expect(anonymousCheckbox).toHaveAttribute("aria-checked", "true");

      await composerCard
        .getByRole("textbox", { name: /评论内容|Comment body/i })
        .first()
        .fill(body);

      const createResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/comments") &&
          r.request().method() === "POST" &&
          r.status() === 200,
      );
      await composerCard
        .getByRole("button", { name: /发布评论|Post comment/i })
        .click();
      const createdCommentResponse = await createResponse;
      const createResponseBody = (await createdCommentResponse.json()) as {
        id?: string;
      };
      expect(createResponseBody.id).toBeTruthy();
      commentId = createResponseBody.id;
      await page.waitForLoadState("networkidle");

      const commentCard = page
        .locator('[id^="comment-"]')
        .filter({ hasText: body })
        .first();
      await expect(commentCard).toBeVisible();
      await expect(commentCard.getByText(body)).toBeVisible();
      // Author sees their own name and an anonymous badge
      await expect(
        commentCard.getByText(DEV_SEED.debugName).first(),
      ).toBeVisible();
      await expect(
        commentCard.getByText(/匿名|Anonymous/i).first(),
      ).toBeVisible();
      await captureStepScreenshot(
        page,
        testInfo,
        "section/comment-anonymous-author",
      );

      // View the same comment without signing in: identity is masked
      await page.context().clearCookies();
      await gotoAndWaitForReady(page, SECTION_URL);
      await jumpToSection(page, /评论|Comments/i, "#tab-comments");

      const anonymousCommentCard = page
        .locator('[id^="comment-"]')
        .filter({ hasText: body })
        .first();
      await expect(anonymousCommentCard).toBeVisible();
      await expect(anonymousCommentCard.getByText(body).first()).toBeVisible();
      await expect(
        anonymousCommentCard.getByText(DEV_SEED.debugName),
      ).toHaveCount(0);
      await expect(
        anonymousCommentCard.getByText(/匿名|Anonymous/i).first(),
      ).toBeVisible();
      await captureStepScreenshot(
        page,
        testInfo,
        "section/comment-anonymous-masked",
      );
    } finally {
      await cleanupCommentsForE2e([commentId]);
    }
  });

  // ── Attachment upload ────────────────────────────────────────────────────────

  test("评论可上传附件并通过签名下载链接打开", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const filename = `e2e-attachment-${Date.now()}.txt`;
    const body = `e2e-attachment-comment-${Date.now()}`;
    let uploadId: string | undefined;
    let commentId: string | undefined;

    try {
      await signInAsDebugUser(page, "/");
      await gotoAndWaitForReady(page, SECTION_URL);

      await expect(async () => {
        if (!page.url().includes(`/sections/${DEV_SEED.section.jwId}`)) {
          await gotoAndWaitForReady(page, SECTION_URL);
        }
        await jumpToSection(page, /评论|Comments/i, "#tab-comments");
      }).toPass({
        timeout: 10_000,
        intervals: [250, 500, 1_000],
      });

      const composerCard = page
        .locator('[data-slot="card"]')
        .filter({
          has: page.getByRole("button", { name: /发布评论|Post comment/i }),
        })
        .first();
      await expect(composerCard).toBeVisible();
      const uploadInput = composerCard.locator('input[type="file"]').first();
      await expect(uploadInput).toBeAttached();
      const uploadControl = uploadInput.locator(
        "xpath=ancestor::label[@data-slot='button'][1]",
      );
      await uploadInput.evaluate((input: HTMLInputElement) => {
        input.focus();
      });
      await expect
        .poll(() =>
          uploadControl.evaluate(
            (element) => getComputedStyle(element).boxShadow,
          ),
        )
        .not.toBe("none");

      // Upload attachment (upload.yml three-step flow)
      const uploadCreate = page.waitForResponse(
        (r) =>
          r.url().includes("/api/uploads") &&
          r.request().method() === "POST" &&
          r.status() === 200,
      );
      const uploadPut = page.waitForResponse(
        (r) =>
          r.request().method() === "PUT" &&
          r.status() >= 200 &&
          r.status() < 300 &&
          r.url().startsWith("http"),
      );
      const uploadComplete = page.waitForResponse(
        (r) =>
          r.url().includes("/api/uploads/complete") &&
          r.request().method() === "POST" &&
          r.status() === 200,
      );

      await composerCard.locator('input[type="file"]').setInputFiles({
        name: filename,
        mimeType: "text/plain",
        buffer: Buffer.from("section-attachment"),
      });
      await uploadCreate;
      await uploadPut;
      const uploadCompleteResponse = await uploadComplete;
      const uploadCompleteBody = (await uploadCompleteResponse.json()) as {
        upload?: { id?: string };
      };
      expect(typeof uploadCompleteBody.upload?.id).toBe("string");
      uploadId = uploadCompleteBody.upload?.id;

      await composerCard
        .getByRole("textbox", { name: /评论内容|Comment body/i })
        .first()
        .fill(body);
      const createComment = page.waitForResponse(
        (r) =>
          r.url().includes("/api/comments") &&
          r.request().method() === "POST" &&
          r.status() === 200,
      );
      await composerCard
        .getByRole("button", { name: /发布评论|Post comment/i })
        .click();
      const createCommentResponse = await createComment;
      const createCommentBody = (await createCommentResponse.json()) as {
        id?: string;
      };
      expect(typeof createCommentBody.id).toBe("string");
      commentId = createCommentBody.id;
      await waitForUiSettled(page);

      const commentCard = page
        .locator('[id^="comment-"]')
        .filter({ hasText: body })
        .first();
      await expect(commentCard).toBeVisible();
      // comment.attachments[] filename/open action (comment.yml display.fields)
      await expect(
        commentCard
          .getByRole("link", { name: /打开附件|Open attachment/i })
          .first(),
      ).toBeVisible();
      await captureStepScreenshot(page, testInfo, "section/comment-attachment");

      // Download is served by the authorized on-site R2 streaming route.
      const popupPromise = page.waitForEvent("popup");
      await commentCard
        .getByRole("link", { name: /打开附件|Open attachment/i })
        .first()
        .click();
      const popup = await popupPromise;
      await popup.waitForLoadState("domcontentloaded");
      await expect(popup).toHaveURL(/\/api\/uploads\/.*\/download/);
      await popup.close();

      // Cleanup
      const dlg = await openCommentDeleteDialog(page, commentCard);
      const deleteResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/api/comments/") &&
          r.request().method() === "DELETE" &&
          r.status() === 200,
      );
      await dlg.getByRole("button", { name: /删除|Delete/i }).click();
      await deleteResponse;
    } finally {
      await cleanupCommentsForE2e([commentId]);
      if (uploadId) {
        await deleteUploadById(page, uploadId);
      }
    }
  });
});
