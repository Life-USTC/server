/**
 * E2E tests for /welcome
 *
 * ## Data Represented (user.yml → first-login-welcome.display.fields)
 * - user.name (current value display)
 * - user.username (current value display)
 * - user.image (current avatar)
 * - user.profilePictures[] (avatar selector grid)
 * - semesters[] (semester dropdown options)
 * - defaultSemesterId (preselected semester)
 *
 * ## Features
 * - Unauthenticated → redirect to /signin
 * - Staged flow: required profile step, then optional subscriptions and
 *   orientation steps, each with a progress indicator
 * - Users with no name/username must complete the profile step first
 * - Avatar selector grid and custom avatar upload are shown
 * - Semester dropdown pre-selects the current semester (subscriptions step)
 *
 * ## Edge Cases
 * - A complete profile requesting the profile step leaves onboarding
 * - The final step returns to the original callbackUrl
 * - Name and username fields are restored to seed values after test
 */
import { expect, test } from "@playwright/test";
import { expectRequiresSignIn, signInAsDebugUser } from "../../../utils/auth";
import { DEV_SEED } from "../../../utils/dev-seed";
import {
  getCurrentSessionUser,
  getUserProfileById,
  updateUserProfileById,
} from "../../../utils/e2e-db";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";
import { assertPageContract } from "../_shared/page-contract";

// These tests mutate the shared debug user profile.
test.describe.configure({ mode: "serial" });

test("/account/welcome 未登录重定向到登录页", async ({ page }, testInfo) => {
  await expectRequiresSignIn(page, "/account/welcome");
  await captureStepScreenshot(page, testInfo, "welcome/unauthorized");
});

test("/account/welcome 资料步骤显示必填字段与进度", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  await signInAsDebugUser(page, "/");
  const sessionUser = await getCurrentSessionUser(page);
  const originalUser = await getUserProfileById(sessionUser.id);

  await updateUserProfileById(sessionUser.id, { name: null, username: null });

  try {
    await gotoAndWaitForReady(page, "/account/welcome", {
      testInfo,
      screenshotLabel: "welcome",
    });

    // user.name and user.username fields (user.yml first-login-welcome.display.fields)
    await expect(
      page.getByRole("textbox", { name: /^(姓名|Name)\b/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: /^(用户名|Username)\b/i }),
    ).toBeVisible();
    await expect(
      page.getByLabel(/上传自己的头像|Upload your own avatar/i),
    ).toBeVisible();

    // user.image / user.profilePictures[] — avatar area should be visible
    const avatarArea = page
      .locator('[data-testid="avatar-selector"], img[alt], [role="img"]')
      .first();
    await expect(avatarArea).toBeVisible();

    // Only the current step is rendered, so later steps stay out of the way.
    await expect(page.getByText(/第 1 步|Step 1 of/i)).toBeVisible();
    await expect(page.getByTestId("app-sidebar")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /打开搜索|Open search/i }),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-shell-navigation="mobile-primary"]'),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: /^(导入|Import)$/i,
      }),
    ).toHaveCount(0);

    await captureStepScreenshot(page, testInfo, "welcome/fields");
  } finally {
    await updateUserProfileById(sessionUser.id, {
      name: originalUser.name ?? DEV_SEED.debugName,
      username: originalUser.username ?? DEV_SEED.debugUsername,
      image: originalUser.image ?? null,
    });
  }
});

test("/account/welcome 本地图片处理不可用时保留表单并显示错误", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signInAsDebugUser(page, "/");
  const sessionUser = await getCurrentSessionUser(page);
  const originalUser = await getUserProfileById(sessionUser.id);
  await updateUserProfileById(sessionUser.id, { name: null, username: null });

  try {
    await gotoAndWaitForReady(page, "/account/welcome");
    await page
      .getByLabel(/上传自己的头像|Upload your own avatar/i)
      .setInputFiles({
        name: "avatar.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6n0sAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    await page
      .getByRole("textbox", { name: /^(姓名|Name)\b/i })
      .fill(DEV_SEED.debugName);
    await page
      .getByRole("textbox", { name: /^(用户名|Username)\b/i })
      .fill(DEV_SEED.debugUsername);
    await page.getByRole("button", { name: /继续|Continue/i }).click();
    await expect(page).toHaveURL(/\/account\/welcome(?:\?.*)?$/);
    await expect(
      page.getByText(
        /头像处理服务暂时不可用|Avatar processing is temporarily unavailable/i,
      ),
    ).toBeVisible();

    const unchangedUser = await getUserProfileById(sessionUser.id);
    expect(unchangedUser.image).toBe(originalUser.image);
  } finally {
    await updateUserProfileById(sessionUser.id, {
      name: originalUser.name ?? DEV_SEED.debugName,
      username: originalUser.username ?? DEV_SEED.debugUsername,
      image: originalUser.image ?? null,
    });
  }
});

test("资料不完整的登录用户从普通页面重定向到 /welcome", async ({ page }) => {
  test.setTimeout(300_000);
  await signInAsDebugUser(page, "/");
  const sessionUser = await getCurrentSessionUser(page);
  const originalUser = await getUserProfileById(sessionUser.id);

  await updateUserProfileById(sessionUser.id, {
    name: null,
    username: null,
  });

  try {
    await gotoAndWaitForReady(page, "/account/settings", {
      expectMainContent: false,
    });

    await expect(page).toHaveURL(
      /\/account\/welcome\?callbackUrl=%2Faccount%2Fsettings$/,
    );
    await expect(
      page.getByRole("textbox", { name: /^(姓名|Name)\b/i }),
    ).toBeVisible();
  } finally {
    await updateUserProfileById(sessionUser.id, {
      name: originalUser.name ?? DEV_SEED.debugName,
      username: originalUser.username ?? DEV_SEED.debugUsername,
      image: originalUser.image ?? null,
    });
  }
});

test("/account/welcome 完成后返回原回调页面", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await signInAsDebugUser(page, "/");
  const sessionUser = await getCurrentSessionUser(page);
  const originalUser = await getUserProfileById(sessionUser.id);

  await updateUserProfileById(sessionUser.id, {
    name: null,
    username: null,
  });

  try {
    await gotoAndWaitForReady(page, "/account/settings", {
      expectMainContent: false,
    });

    await expect(page).toHaveURL(
      /\/account\/welcome\?callbackUrl=%2Faccount%2Fsettings$/,
    );
    await page
      .getByRole("textbox", { name: /^(姓名|Name)\b/i })
      .fill(DEV_SEED.debugName);
    await page
      .getByRole("textbox", { name: /^(用户名|Username)\b/i })
      .fill(DEV_SEED.debugUsername);

    await page.getByRole("button", { name: /继续|Continue/i }).click();

    await expect(page).toHaveURL(
      /\/account\/welcome\?step=subscriptions&callbackUrl=%2Faccount%2Fsettings$/,
      { timeout: 15_000 },
    );
    await page.getByRole("link", { name: /暂时跳过|Skip for now/i }).click();
    await expect(page).toHaveURL(
      /\/account\/welcome\?step=finish&callbackUrl=%2Faccount%2Fsettings$/,
    );
    await page
      .getByRole("link", { name: /进入工作区|Go to workspace/i })
      .click();

    await expect(page).toHaveURL(/\/account\/settings\/profile(?:\?.*)?$/, {
      timeout: 15_000,
    });
    await expect(page.locator("#main-content")).toBeVisible();
    await captureStepScreenshot(page, testInfo, "welcome/completed-callback");
  } finally {
    await updateUserProfileById(sessionUser.id, {
      name: originalUser.name ?? DEV_SEED.debugName,
      username: originalUser.username ?? DEV_SEED.debugUsername,
      image: originalUser.image ?? null,
    });
  }
});

test("/account/welcome 未完善资料的用户可完成资料并返回首页", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  await signInAsDebugUser(page, "/");

  const sessionUser = await getCurrentSessionUser(page);
  const originalUser = await getUserProfileById(sessionUser.id);

  await updateUserProfileById(sessionUser.id, {
    name: null,
    username: null,
  });

  try {
    await gotoAndWaitForReady(page, "/account/welcome", {
      testInfo,
      screenshotLabel: "welcome",
    });

    await expect(page).toHaveURL(/\/account\/welcome(?:\?.*)?$/);
    await page
      .getByRole("textbox", { name: /^(姓名|Name)\b/i })
      .fill(DEV_SEED.debugName);
    await page
      .getByRole("textbox", { name: /^(用户名|Username)\b/i })
      .fill(DEV_SEED.debugUsername);

    await page.getByRole("button", { name: /继续|Continue/i }).click();

    await expect(page).toHaveURL(/step=subscriptions/, { timeout: 15_000 });
    await expect(page.getByText(/第 2 步|Step 2 of/i)).toBeVisible();
    await page.getByRole("link", { name: /暂时跳过|Skip for now/i }).click();
    await expect(page.getByText(/第 3 步|Step 3 of/i)).toBeVisible();
    await page
      .getByRole("link", { name: /进入工作区|Go to workspace/i })
      .click();

    await expect(page).toHaveURL(/\/workspace\/overview(?:\?.*)?$/, {
      timeout: 15_000,
    });
    await expect(page.locator("#main-content")).toBeVisible();

    const updatedUser = await getUserProfileById(sessionUser.id);
    expect(updatedUser.name).toBe(DEV_SEED.debugName);
    expect(updatedUser.username).toBe(DEV_SEED.debugUsername);
    await captureStepScreenshot(page, testInfo, "welcome/completed");
  } finally {
    await updateUserProfileById(sessionUser.id, {
      name: originalUser.name ?? DEV_SEED.debugName,
      username: originalUser.username ?? DEV_SEED.debugUsername,
      image: originalUser.image ?? null,
    });
  }
});

test("/account/welcome 订阅步骤说明教务导入并提供粘贴入口", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  await signInAsDebugUser(page, "/");

  await gotoAndWaitForReady(
    page,
    "/account/welcome?step=subscriptions&callbackUrl=%2Fworkspace%2Foverview",
    { testInfo, screenshotLabel: "welcome-subscriptions" },
  );

  await expect(page.getByTestId("app-sidebar")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /打开搜索|Open search/i }),
  ).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await expect(
    page.getByRole("heading", {
      name: /从教务系统导入选课|Import your course selection from the academic system/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/由于技术限制|Because of technical limits/i),
  ).toBeVisible();
  await expect(page.getByText(/COMP3001\.01/)).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: /^(本科生教务|Undergraduate academic system)$/i,
    }),
  ).toHaveAttribute("href", "https://jw.ustc.edu.cn/");
  await expect(
    page.getByRole("link", {
      name: /^(研究生教务|Graduate academic system)$/i,
    }),
  ).toHaveAttribute("href", "https://yjs1.ustc.edu.cn/");

  const semesterSelector = page
    .getByRole("combobox", { name: /^(学期|Semester)\b/i })
    .first();
  await expect(semesterSelector).toBeVisible();
  await expect(semesterSelector).toContainText(DEV_SEED.semesterNameCn);
  await expect(
    page.getByRole("button", { name: /^(导入|Import)$/i }),
  ).toBeVisible();

  await captureStepScreenshot(page, testInfo, "welcome/next-steps");
});

test("/account/welcome 最后一步展示平台引导并可返回上一步", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  await signInAsDebugUser(page, "/");

  await gotoAndWaitForReady(
    page,
    "/account/welcome?step=finish&callbackUrl=%2Fworkspace%2Foverview",
    { testInfo, screenshotLabel: "welcome-finish" },
  );

  await expect(
    page.getByRole("heading", { name: /^(接下来|Next)$/ }),
  ).toBeVisible();
  await expect(page.getByText(/最后一公里|last-mile work/i)).toBeVisible();
  await expect(
    page.getByText(/课表、作业、考试、待办|Timetable, homework, exams, and todos/i),
  ).toBeVisible();
  await expect(page.getByText(/个人主页|personal homepage/i)).toBeVisible();
  await expect(page.getByText(/助教|course homepage/i)).toBeVisible();
  await expect(page.getByText(/CalDAV/i)).toBeVisible();
  await expect(page.getByText(/MCP/)).toBeVisible();
  await expect(page.getByTestId("app-sidebar")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /打开搜索|Open search/i }),
  ).toHaveCount(0);
  await captureStepScreenshot(page, testInfo, "welcome/finish");

  await page.getByRole("link", { name: /上一步|Back/i }).click();
  await expect(page).toHaveURL(/step=subscriptions/);
});

test("页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/account/welcome", testInfo });
});
