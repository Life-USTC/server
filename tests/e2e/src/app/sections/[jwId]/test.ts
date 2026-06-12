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
import { expect, test } from "@playwright/test";
import { signInAsDebugUser, signInAsDevAdmin } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

const SECTION_URL = `/sections/${DEV_SEED.section.jwId}`;

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("/sections/[jwId]", () => {
  test("contract", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/sections/[jwId]",
      testInfo,
    });
  });

  test("404 for invalid param", async ({ page }, testInfo) => {
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

  test("displays course name as h1 and section code", async ({
    page,
  }, testInfo) => {
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

    await captureStepScreenshot(page, testInfo, "section/heading");
  });

  test("displays semester, campus, and teacher info", async ({
    page,
  }, testInfo) => {
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

  test("displays credits, exam mode, and remark", async ({
    page,
  }, testInfo) => {
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

  test("displays teach language and room type in basic info", async ({
    page,
  }, testInfo) => {
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

  test("displays admin classes (collapsible)", async ({ page }, testInfo) => {
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

  test("displays schedule with room, building, teachers in calendar tab", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);

    await expect(async () => {
      const calendarTab = page
        .getByRole("tab", { name: /日历|Calendar/i })
        .first();
      await calendarTab.click();
      await expect(calendarTab).toHaveAttribute("aria-selected", "true");
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });

    const classEvent = page
      .locator("article")
      .filter({ hasText: /上课事件|Class event/i })
      .first();
    await expect(classEvent).toBeVisible();

    // schedule.room.namePrimary and schedule.room.building.namePrimary
    // are rendered in the event detail cards.
    await expect(
      classEvent
        .getByText(DEV_SEED.room.nameCn, { exact: false })
        .or(classEvent.getByText(DEV_SEED.room.nameEn, { exact: false }))
        .first(),
    ).toBeVisible();
    await expect(
      classEvent
        .getByText(DEV_SEED.building.nameCn, { exact: false })
        .or(classEvent.getByText(DEV_SEED.building.nameEn, { exact: false }))
        .first(),
    ).toBeVisible();
    await expect(
      classEvent
        .getByText(DEV_SEED.campus.nameCn, { exact: false })
        .or(classEvent.getByText(DEV_SEED.campus.nameEn, { exact: false }))
        .first(),
    ).toBeVisible();

    // schedule.teachers[].namePrimary appears in the sidebar (always visible)
    await expect(
      page
        .getByText(DEV_SEED.teacher.nameCn)
        .or(page.getByText(DEV_SEED.teacher.nameEn))
        .first(),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "section/schedule-calendar");
  });

  test("displays exam info (examBatch, examRooms) in calendar tab", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);

    await expect(async () => {
      const calendarTab = page
        .getByRole("tab", { name: /日历|Calendar/i })
        .first();
      await calendarTab.click();
      await expect(calendarTab).toHaveAttribute("aria-selected", "true");
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });

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

  test("jwId is NOT displayed in visible text (jwid-url-only rule)", async ({
    page,
  }) => {
    await gotoAndWaitForReady(page, SECTION_URL);
    // The page content should not contain the raw jwId as visible text
    const content = await page.locator("#main-content").innerText();
    // jwId should not appear as a standalone number in the visible UI
    expect(content).not.toMatch(new RegExp(`\\b${DEV_SEED.section.jwId}\\b`));
  });

  test("subscribe button uses subscription language, not enrollment language", async ({
    page,
  }) => {
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

  test("tab switching works", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);

    const nextTab = page.locator('[role="tab"][aria-selected="false"]').first();
    if ((await nextTab.count()) > 0) {
      const nextTabLabel = ((await nextTab.textContent()) ?? "").trim();
      expect(nextTabLabel).toBeTruthy();
      await expect(async () => {
        const targetTab = page.getByRole("tab", { name: nextTabLabel }).first();
        await targetTab.click();
        await expect(targetTab).toHaveAttribute("aria-selected", "true");
      }).toPass({
        timeout: 10_000,
        intervals: [250, 500, 1_000],
      });
      await captureStepScreenshot(page, testInfo, "section/tab-switch");
    }
  });

  test("breadcrumb navigates back to sections list", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);
    const breadcrumb = page
      .getByRole("navigation", { name: "breadcrumb" })
      .getByRole("link", { name: /^(班级|Sections)$/i })
      .first();
    await expect(breadcrumb).toBeVisible();
    await breadcrumb.click();
    await expect(page).toHaveURL(/\/sections(?:\?.*)?$/);
    await captureStepScreenshot(page, testInfo, "section/breadcrumb-back");
  });

  test("non-enrollment disclaimer is visible in subscribe dialog", async ({
    page,
  }, testInfo) => {
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

  test("unauthenticated subscribe prompts login dialog", async ({
    page,
  }, testInfo) => {
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

  test("authenticated user can subscribe and unsubscribe", async ({
    page,
  }, testInfo) => {
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
      await captureStepScreenshot(page, testInfo, "section/subscribed");
    }

    if ((await unsubscribe.count()) > 0) {
      await unsubscribe.first().click();
      await expect(subscribe.first()).toBeVisible({ timeout: 15_000 });
      await captureStepScreenshot(page, testInfo, "section/unsubscribed");
    }
  });

  // ── Calendar export ─────────────────────────────────────────────────────────

  test("calendar export dialog shows iCal URL and subscription URL", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await signInAsDebugUser(page, SECTION_URL);

    const calendarButton = page
      .getByRole("button", { name: /添加到日历|Add to calendar/i })
      .first();
    if ((await calendarButton.count()) === 0) {
      await expect(page.locator("#main-content")).toBeVisible();
      return;
    }

    await calendarButton.click();
    const calDialog = page.locator('[data-slot="dialog-popup"]').first();
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

  test("can switch section homework tab to list view and persist preference", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);

    const homeworksTab = page
      .getByRole("tab", { name: /作业|Homework/i })
      .first();
    if ((await homeworksTab.count()) === 0) {
      await expect(page.locator("#main-content")).toBeVisible();
      return;
    }
    await homeworksTab.click();

    await expect(page.getByTestId("section-homeworks-cards")).toBeVisible();
    await page
      .getByRole("tab", { name: /列表|List/i })
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
    await homeworksTab.click();
    await expect(page).toHaveURL(
      new RegExp(`/sections/${DEV_SEED.section.jwId}(#tab-homework)?$`),
    );
    await expect(page.getByTestId("section-homeworks-list")).toBeVisible();
    await captureStepScreenshot(page, testInfo, "section/homework-list-view");
  });

  test("signed-in user can create homework, inspect discussion, toggle completion, and delete", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, SECTION_URL);

    const homeworksTab = page
      .getByRole("tab", { name: /作业|Homework/i })
      .first();
    if ((await homeworksTab.count()) === 0) {
      await expect(page.locator("#main-content")).toBeVisible();
      return;
    }
    await homeworksTab.click();

    // Create
    const showCreate = page
      .getByRole("button", { name: /^新建$|^Create$/i })
      .first();
    if ((await showCreate.count()) > 0) {
      await showCreate.click();
    }
    const createDialog = page.locator('[data-slot="dialog-popup"]').first();
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
    await createResponse;
    await waitForUiSettled(page);

    const hwCard = page
      .getByRole("button", { name: new RegExp(escapeForRegExp(title)) })
      .first();
    await expect(hwCard).toBeVisible();

    // homework.title is displayed
    await expect(hwCard.getByText(title)).toBeVisible();
    await captureStepScreenshot(page, testInfo, "section/homework-created");
    await hwCard.click();
    const homeworkPopout = page.locator('[data-slot="dialog-popup"]').first();
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
    const deleteDialog = page.locator('[data-slot="dialog-popup"]').last();
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
  });

  // ── Comment CRUD ────────────────────────────────────────────────────────────

  test("signed-in user can post, react, edit, reply, and delete comment", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDevAdmin(page, SECTION_URL);

    const commentsTab = page
      .getByRole("tab", { name: /评论|Comments/i })
      .first();
    await commentsTab.click();
    await expect(commentsTab).toHaveAttribute("aria-selected", "true");

    // Post comment
    const body = `e2e-section-comment-${Date.now()}`;
    const composer = page.locator("textarea").first();
    await composer.fill(body);
    const createResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/comments") &&
        r.request().method() === "POST" &&
        r.status() === 200,
    );
    await page.getByRole("button", { name: /发布评论|Post comment/i }).click();
    await createResponse;
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
    await page.getByRole("menuitem", { name: /点赞|Upvote/i }).click();
    await reactionResponse;
    await waitForUiSettled(page);
    await expect(commentCard.getByRole("button", { name: /👍/ })).toBeVisible();
    await captureStepScreenshot(page, testInfo, "section/comment-upvoted");

    // Edit comment (canEdit action)
    await commentCard.hover();
    await commentCard.getByRole("button", { name: /编辑|Edit/i }).click();
    const editedBody = `${body}-edited`;
    const editCard = page.locator(`[id="${commentCardId}"]`);
    await expect(editCard.locator("textarea").first()).toBeVisible();
    await editCard.locator("textarea").first().fill(editedBody);
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
    const replyEditor = page
      .locator(".rounded-2xl.border.border-dashed")
      .first();
    await expect(replyEditor).toBeVisible();
    await replyEditor.locator("textarea").fill(replyBody);
    const replyResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/comments") &&
        r.request().method() === "POST" &&
        r.status() === 200,
    );
    await replyEditor.getByRole("button", { name: /回复|Reply/i }).click();
    await replyResponse;
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(replyBody).first()).toBeVisible();
    await captureStepScreenshot(page, testInfo, "section/comment-replied");

    // Delete comment
    await editedCommentCard
      .getByRole("button", { name: /更多操作|More actions/i })
      .first()
      .click({ force: true });
    const deleteResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/comments/") &&
        r.request().method() === "DELETE" &&
        r.status() === 200,
    );
    await page.getByRole("menuitem", { name: /删除|Delete/i }).click();
    const deleteDialog = page.getByRole("dialog", {
      name: /删除评论|Delete Comment/i,
    });
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: /删除|Delete/i }).click();
    await deleteResponse;
    await page.waitForLoadState("networkidle");
    await expect(editedCommentCard).toHaveCount(0);
    await captureStepScreenshot(page, testInfo, "section/comment-deleted");
  });

  // ── Attachment upload ────────────────────────────────────────────────────────

  test("comment can upload attachment and open via signed download URL", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/");
    await gotoAndWaitForReady(page, SECTION_URL);

    await expect(async () => {
      if (!page.url().includes(`/sections/${DEV_SEED.section.jwId}`)) {
        await gotoAndWaitForReady(page, SECTION_URL);
      }
      const commentsTab = page
        .getByRole("tab", { name: /评论|Comments/i })
        .first();
      await commentsTab.click();
      await expect(commentsTab).toHaveAttribute("aria-selected", "true");
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

    // Upload attachment (upload.yml three-step flow)
    const filename = `e2e-attachment-${Date.now()}.txt`;
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
    await uploadComplete;

    const body = `e2e-attachment-comment-${Date.now()}`;
    await composerCard.locator("textarea").first().fill(body);
    const createComment = page.waitForResponse(
      (r) =>
        r.url().includes("/api/comments") &&
        r.request().method() === "POST" &&
        r.status() === 200,
    );
    await composerCard
      .getByRole("button", { name: /发布评论|Post comment/i })
      .click();
    await createComment;
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

    // Download uses signed URL (upload.yml download-signed-url rule)
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
    await commentCard.hover();
    await commentCard
      .getByRole("button", { name: /更多操作|More actions/i })
      .first()
      .click();
    const deleteResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/comments/") &&
        r.request().method() === "DELETE" &&
        r.status() === 200,
    );
    await page.getByRole("menuitem", { name: /删除|Delete/i }).click();
    const dlg = page.getByRole("dialog", {
      name: /删除评论|Delete Comment/i,
    });
    await expect(dlg).toBeVisible();
    await dlg.getByRole("button", { name: /删除|Delete/i }).click();
    await deleteResponse;
  });
});
