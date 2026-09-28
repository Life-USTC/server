import { expect } from "@playwright/test";
import { expectRequiresSignIn } from "../../../utils/auth";
import { getUserProfileById, test } from "../../../utils/onboarding-fixture";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";

test("/account/welcome 未登录重定向到登录页", async ({ page }, testInfo) => {
  await expectRequiresSignIn(page, "/account/welcome");
  await captureStepScreenshot(page, testInfo, "welcome/unauthorized");
});

test("/account/welcome 资料步骤显示必填字段与进度", async ({
  page,
  incompleteProfile: _incompleteProfile,
}, testInfo) => {
  test.setTimeout(300_000);
  await gotoAndWaitForReady(page, "/account/welcome", {
    testInfo,
    screenshotLabel: "welcome",
  });

  // Required profile fields are shown before optional onboarding steps.
  await expect(
    page.getByRole("textbox", { name: /^(昵称|Nickname)(?:\s|$)/i }),
  ).toHaveValue("");
  await expect(page.getByRole("textbox", { name: /^ID\b/i })).toBeVisible();
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
});

test("/account/welcome 本地图片处理不可用时保留表单并显示错误", async ({
  page,
  incompleteProfile,
  isolatedWorker,
}) => {
  test.setTimeout(300_000);
  const profile = incompleteProfile;
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
    .getByRole("textbox", { name: /^(昵称|Nickname)(?:\s|$)/i })
    .fill(profile.name);
  await page.getByRole("textbox", { name: /^ID\b/i }).fill(profile.username);
  await page.getByRole("button", { name: /继续|Continue/i }).click();
  await expect(page).toHaveURL(/\/account\/welcome(?:\?.*)?$/);
  await expect(
    page.getByText(
      /头像处理服务暂时不可用|Avatar processing is temporarily unavailable/i,
    ),
  ).toBeVisible();

  const unchangedUser = await getUserProfileById(
    isolatedWorker.database.owner,
    profile.id,
  );
  expect(unchangedUser.image).toBe(profile.image);
  expect(unchangedUser.name).toBe("");
  expect(unchangedUser.username).toBeNull();
  await expect(
    page.getByRole("textbox", { name: /^(昵称|Nickname)(?:\s|$)/i }),
  ).toHaveValue(profile.name);
  await expect(page.getByRole("textbox", { name: /^ID\b/i })).toHaveValue(
    profile.username,
  );
});

test("/account/welcome 完成后返回原回调页面", async ({
  page,
  incompleteProfile,
  isolatedWorker,
}, testInfo) => {
  test.setTimeout(300_000);
  const profile = incompleteProfile;
  await gotoAndWaitForReady(page, "/account/settings", {
    expectMainContent: false,
  });

  await expect(page).toHaveURL(
    /\/account\/welcome\?callbackUrl=%2Faccount%2Fsettings$/,
  );
  await expect(
    page.getByRole("textbox", { name: /^(昵称|Nickname)(?:\s|$)/i }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: /^(昵称|Nickname)(?:\s|$)/i })
    .fill(profile.name);
  await page.getByRole("textbox", { name: /^ID\b/i }).fill(profile.username);

  await page.getByRole("button", { name: /继续|Continue/i }).click();

  await expect(page).toHaveURL(
    /\/account\/welcome\?step=subscriptions&callbackUrl=%2Faccount%2Fsettings$/,
    { timeout: 15_000 },
  );
  await page.getByRole("link", { name: /暂时跳过|Skip for now/i }).click();
  await expect(page).toHaveURL(
    /\/account\/welcome\?step=finish&callbackUrl=%2Faccount%2Fsettings$/,
  );
  await page.getByRole("link", { name: /进入工作区|Go to workspace/i }).click();

  await expect(page).toHaveURL(/\/account\/settings\/profile(?:\?.*)?$/, {
    timeout: 15_000,
  });
  await expect(page.locator("#main-content")).toBeVisible();
  expect(
    await getUserProfileById(isolatedWorker.database.owner, profile.id),
  ).toMatchObject({ name: profile.name, username: profile.username });
  await captureStepScreenshot(page, testInfo, "welcome/completed-callback");
});

test("/account/welcome 未完善资料的用户可完成资料并返回首页", async ({
  page,
  incompleteProfile,
  isolatedWorker,
}, testInfo) => {
  test.setTimeout(300_000);
  const profile = incompleteProfile;
  await gotoAndWaitForReady(page, "/account/welcome", {
    testInfo,
    screenshotLabel: "welcome",
  });

  await expect(page).toHaveURL(/\/account\/welcome(?:\?.*)?$/);
  await page
    .getByRole("textbox", { name: /^(昵称|Nickname)(?:\s|$)/i })
    .fill(profile.name);
  await page.getByRole("textbox", { name: /^ID\b/i }).fill(profile.username);

  await page.getByRole("button", { name: /继续|Continue/i }).click();

  await expect(page).toHaveURL(/step=subscriptions/, { timeout: 15_000 });
  await expect(page.getByText(/第 2 步|Step 2 of/i)).toBeVisible();
  await page.getByRole("link", { name: /暂时跳过|Skip for now/i }).click();
  await expect(page.getByText(/第 3 步|Step 3 of/i)).toBeVisible();
  await page.getByRole("link", { name: /进入工作区|Go to workspace/i }).click();

  await expect(page).toHaveURL(/\/workspace\/overview(?:\?.*)?$/, {
    timeout: 15_000,
  });
  await expect(page.locator("#main-content")).toBeVisible();

  const updatedUser = await getUserProfileById(
    isolatedWorker.database.owner,
    profile.id,
  );
  expect(updatedUser.name).toBe(profile.name);
  expect(updatedUser.username).toBe(profile.username);
  await captureStepScreenshot(page, testInfo, "welcome/completed");
});

test("/account/welcome 可选择已上传头像并保存", async ({
  page,
  avatars,
  isolatedWorker,
}) => {
  test.setTimeout(300_000);
  const { profile, options: avatarOptions } = avatars;
  await gotoAndWaitForReady(page, "/account/welcome");
  const secondAvatar = page.getByRole("radio", {
    name: /头像选项 2|Avatar option 2/i,
  });
  await expect(secondAvatar).toBeVisible();
  await expect(secondAvatar).toBeEnabled();
  await secondAvatar.click();
  await expect(secondAvatar).toHaveAttribute("data-state", "on");
  await expect(
    page.getByRole("img", { name: /个人头像|Profile picture/i }),
  ).toHaveAttribute("src", avatarOptions[1]);

  await page
    .getByRole("textbox", { name: /^(昵称|Nickname)(?:\s|$)/i })
    .fill(profile.name);
  await page.getByRole("textbox", { name: /^ID\b/i }).fill(profile.username);
  await page.getByRole("button", { name: /继续|Continue/i }).click();
  await expect(page).toHaveURL(/step=subscriptions/, { timeout: 15_000 });
  await page.getByRole("link", { name: /暂时跳过|Skip for now/i }).click();
  await page.getByRole("link", { name: /进入工作区|Go to workspace/i }).click();
  await expect(page).toHaveURL(/\/workspace\/overview(?:\?.*)?$/, {
    timeout: 15_000,
  });
  await expect
    .poll(
      async () =>
        (await getUserProfileById(isolatedWorker.database.owner, profile.id))
          .image,
    )
    .toBe(avatarOptions[1]);
});

test("user.welcome-subscription-guidance", async ({
  page,
  semester,
  account: _account,
}, testInfo) => {
  test.setTimeout(300_000);

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

  await expect(
    page.getByRole("textbox", {
      name: /^(班级代码|Section codes)$/i,
    }),
  ).toBeVisible();

  const semesterSelector = page
    .getByRole("combobox", { name: /^(学期|Semester)\b/i })
    .first();
  await expect(semesterSelector).toBeVisible();
  await expect(semesterSelector).toContainText(semester.nameCn);
  await expect(
    page.getByRole("button", { name: /^(导入|Import)$/i }),
  ).toBeVisible();

  await captureStepScreenshot(page, testInfo, "welcome/next-steps");
});

test("/account/welcome 最后一步展示平台引导并可返回上一步", async ({
  page,
  account: _account,
}, testInfo) => {
  test.setTimeout(300_000);

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
    page.getByText(
      /课表、作业、考试、待办|Timetable, homework, exams, and todos/i,
    ),
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
