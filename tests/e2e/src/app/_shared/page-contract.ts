import { expect, type Page, type TestInfo } from "@playwright/test";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
  signInAsDevAdmin,
} from "../../../utils/auth";
import { DEV_SEED } from "../../../utils/dev-seed";
import { getCurrentSessionUser } from "../../../utils/e2e-db";
import {
  appSidebar,
  expandWorkspaceSidebarGroup,
  sidebarNavigationLink,
  visibleText,
} from "../../../utils/locators";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";
import {
  resolveSeedSectionId,
  resolveSeedTeacherId,
} from "../../../utils/seed-lookups";

type PageContractCase = {
  routePath: string;
  testInfo?: TestInfo;
};

function getContractWaitUntil(routePath: string) {
  if (
    routePath === "/api/docs/tag/sections" ||
    routePath === "/guides/markdown-support"
  ) {
    return "load" as const;
  }
  return "domcontentloaded" as const;
}

async function maybeCapture(
  page: Page,
  testInfo: TestInfo | undefined,
  name: string,
) {
  if (!testInfo) {
    return;
  }
  await captureStepScreenshot(page, testInfo, name);
}

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function localizedNamePattern(nameCn: string, nameEn: string) {
  return new RegExp(`${escapeForRegExp(nameCn)}|${escapeForRegExp(nameEn)}`);
}

async function gotoContractPage(
  page: Page,
  path: string,
  testInfo: TestInfo | undefined,
) {
  const response = await gotoAndWaitForReady(page, path, {
    waitUntil: getContractWaitUntil(path),
    testInfo,
    screenshotLabel: "contract",
  });

  if (response) {
    expect(response.status()).toBeLessThan(500);
  }

  return response;
}

async function expectMainContent(page: Page) {
  await expect(page.locator("#main-content")).toBeVisible();
}

export async function assertPageContract(
  page: Page,
  { routePath, testInfo }: PageContractCase,
) {
  if (routePath.startsWith("/account/settings/")) {
    if (routePath === "/account/settings") {
      // handled explicitly below for explicitness
    } else {
      await signInAsDebugUser(page, routePath);
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      const expectedTab = routePath.split("/").pop();
      const tabHeading =
        expectedTab === "profile"
          ? /个人资料|Profile/i
          : expectedTab === "accounts"
            ? /账号关联|Accounts/i
            : expectedTab === "content"
              ? /内容偏好|Content/i
              : expectedTab === "danger"
                ? /危险|Danger/i
                : /设置|Settings/i;
      await expect(
        page.getByRole("link", { name: /设置|Settings/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: tabHeading }),
      ).toBeVisible();
      return;
    }
  }

  if (
    routePath === "/workspace/[tab]" ||
    routePath.startsWith("/workspace/") ||
    routePath === "/workspace"
  ) {
    await signInAsDebugUser(page, routePath === "/workspace" ? "/" : routePath);
    await gotoContractPage(page, routePath, testInfo);
    await expectMainContent(page);
    await expandWorkspaceSidebarGroup(page);
    await expect(sidebarNavigationLink(page, /^(今天|Today)$/i)).toBeVisible({
      timeout: 10_000,
    });
    return;
  }

  switch (routePath) {
    case "/admin": {
      await signInAsDevAdmin(page, "/admin");
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      await expect(
        page.getByRole("link", { name: /管理员|Admin/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /用户管理|User Management/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /内容审核|Moderation/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /OAuth|OAuth 客户端/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /校车管理|Shuttle Bus/i }),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "admin-home");
      return;
    }

    case "/admin/bus": {
      await signInAsDevAdmin(page, "/admin/bus");
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", { name: /时刻表版本|Versions/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /导入|Import/i }),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "admin-bus");
      return;
    }

    case "/admin/moderation": {
      await signInAsDevAdmin(page, "/admin/moderation");
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", { name: /内容审核|Moderation/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /评论|Comments/i }),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "admin-moderation");
      return;
    }

    case "/admin/oauth": {
      await signInAsDevAdmin(page, "/admin/oauth");
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", { name: /OAuth|OAuth 客户端/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /创建客户端|Create Client/i }),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "admin-oauth");
      return;
    }

    case "/admin/users": {
      await signInAsDevAdmin(page, "/admin/users");
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", {
          name: /用户管理|User Management|用户列表|Users/i,
        }),
      ).toBeVisible();
      await expect(
        page.locator("table, [role='table'], [data-slot='table']"),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "admin-users");
      return;
    }

    case "/catalog/sections/[jwId]": {
      await gotoContractPage(
        page,
        `/catalog/sections/${DEV_SEED.section.jwId}`,
        testInfo,
      );
      await expectMainContent(page);
      await expect(visibleText(page, DEV_SEED.section.code)).toBeVisible();
      await expect(visibleText(page, DEV_SEED.course.nameCn)).toBeVisible();
      await expect(
        appSidebar(page)
          .getByRole("link", {
            name: localizedNamePattern(
              DEV_SEED.course.nameCn,
              DEV_SEED.course.nameEn,
            ),
          })
          .first(),
      ).toHaveAttribute("aria-current", "page");
      await maybeCapture(page, testInfo, "sections-jwId");
      return;
    }

    case "/catalog/courses/[jwId]": {
      await gotoContractPage(
        page,
        `/catalog/courses/${DEV_SEED.course.jwId}`,
        testInfo,
      );
      await expectMainContent(page);
      await expect(visibleText(page, DEV_SEED.course.nameCn)).toBeVisible();
      await expect(visibleText(page, DEV_SEED.course.code)).toBeVisible();
      await expect(
        page
          .getByTestId("detail-section-nav")
          .getByRole("link", { name: /班级|Sections/i }),
      ).toBeVisible();
      await expect(
        appSidebar(page)
          .getByRole("link", {
            name: localizedNamePattern(
              DEV_SEED.course.nameCn,
              DEV_SEED.course.nameEn,
            ),
          })
          .first(),
      ).toHaveAttribute("aria-current", "page");
      await maybeCapture(page, testInfo, "courses-jwId");
      return;
    }

    case "/catalog/teachers/[id]": {
      await gotoContractPage(
        page,
        `/catalog/teachers/${await resolveSeedTeacherId(page)}`,
        testInfo,
      );
      await expectMainContent(page);
      await expect(visibleText(page, DEV_SEED.teacher.nameCn)).toBeVisible();
      await expect(
        page
          .getByTestId("detail-section-nav")
          .getByRole("link", { name: /授课班级|Teaching Sections/i }),
      ).toBeVisible();
      await expect(
        appSidebar(page)
          .getByRole("link", {
            name: localizedNamePattern(
              DEV_SEED.teacher.nameCn,
              DEV_SEED.teacher.nameEn,
            ),
          })
          .first(),
      ).toHaveAttribute("aria-current", "page");
      await maybeCapture(page, testInfo, "teachers-id");
      return;
    }

    case "/community/users/[username]": {
      await gotoContractPage(
        page,
        `/community/users/${DEV_SEED.adminUsername}`,
        testInfo,
      );
      await expectMainContent(page);
      await expect(visibleText(page, DEV_SEED.adminName)).toBeVisible();
      await expect(
        visibleText(page, `@${DEV_SEED.adminUsername}`),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "u-username");
      return;
    }

    case "/community/users/id/[uid]": {
      await signInAsDevAdmin(page, "/");
      const sessionUser = await getCurrentSessionUser(page);
      await gotoContractPage(
        page,
        `/community/users/id/${sessionUser.id}`,
        testInfo,
      );
      await expectMainContent(page);
      await expect(
        visibleText(page, `@${DEV_SEED.adminUsername}`),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "u-id-uid");
      return;
    }

    case "/community/comments/[id]": {
      await signInAsDebugUser(page);
      const sectionId = await resolveSeedSectionId(page);
      const createResponse = await page.request.post(
        "/api/community/comments",
        {
          data: {
            targetType: "section",
            targetId: String(sectionId),
            body: "e2e mapped route comment",
          },
        },
      );
      expect(createResponse.status()).toBe(201);
      const createBody = (await createResponse.json()) as { id?: string };
      expect(createBody.id).toBeTruthy();

      await gotoContractPage(
        page,
        `/community/comments/${createBody.id}`,
        testInfo,
      );
      await expect(page).toHaveURL(
        new RegExp(
          `/catalog/sections/${DEV_SEED.section.jwId}/comments(?:\\?.*)?#comment-${createBody.id}$`,
        ),
      );
      await expectMainContent(page);
      await maybeCapture(page, testInfo, "comments-id");
      return;
    }

    case "/community/comments/guide": {
      await gotoContractPage(page, "/guides/markdown-support", testInfo);
      await expect(page.locator("#main-content")).toBeVisible();
      await expect(page.locator("pre").first()).toBeVisible();
      await expect(page.locator("table").first()).toBeVisible();
      await maybeCapture(page, testInfo, "comments-guide");
      return;
    }

    case "/account/sign-in": {
      await gotoContractPage(page, routePath, testInfo);
      await expect(page.getByRole("button", { name: /USTC/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /GitHub/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Google/i })).toBeVisible();
      await maybeCapture(page, testInfo, "signin");
      return;
    }

    case "/catalog/bus/map": {
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      await expect(page.locator("svg").first()).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Refresh|刷新/i }),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "bus-map");
      return;
    }

    case "/catalog/sections": {
      await gotoContractPage(
        page,
        `/catalog/sections?search=${encodeURIComponent(DEV_SEED.section.code)}`,
        testInfo,
      );
      await expectMainContent(page);
      // section-list.display.fields: code, course.namePrimary, campus.namePrimary
      await expect(visibleText(page, DEV_SEED.section.code)).toBeVisible();
      await expect(
        page
          .getByText(DEV_SEED.course.nameCn)
          .or(page.getByText(DEV_SEED.course.nameEn))
          .filter({ visible: true })
          .first(),
      ).toBeVisible();
      await expect(
        page
          .getByText(DEV_SEED.campus.nameCn)
          .or(page.getByText(DEV_SEED.campus.nameEn))
          .filter({ visible: true })
          .first(),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "sections");
      return;
    }

    case "/catalog/teachers": {
      await gotoContractPage(
        page,
        `/catalog/teachers?search=${encodeURIComponent(DEV_SEED.teacher.nameCn)}`,
        testInfo,
      );
      await expectMainContent(page);
      // teacher-list.display.fields: namePrimary, department, title, email, _count.sections
      await expect(
        page
          .getByText(DEV_SEED.teacher.nameCn)
          .or(page.getByText(DEV_SEED.teacher.nameEn))
          .filter({ visible: true })
          .first(),
      ).toBeVisible();
      await expect(
        page
          .getByText(DEV_SEED.teacher.departmentNameCn)
          .or(page.getByText(DEV_SEED.teacher.departmentNameEn))
          .filter({ visible: true })
          .first(),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "teachers");
      return;
    }

    case "/catalog/courses": {
      await gotoContractPage(
        page,
        `/catalog/courses?search=${encodeURIComponent(DEV_SEED.course.code)}`,
        testInfo,
      );
      await expectMainContent(page);
      await expect(visibleText(page, DEV_SEED.course.nameCn)).toBeVisible();
      await maybeCapture(page, testInfo, "courses");
      return;
    }

    case "/guides/markdown-support": {
      await gotoContractPage(page, routePath, testInfo);
      await waitForUiSettled(page);
      await expect(page.locator("pre").first()).toBeVisible();
      await expect(page.locator("table").first()).toBeVisible();
      await maybeCapture(page, testInfo, "guides-markdown-support");
      return;
    }

    case "/mobile-app": {
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      await expect(
        page.getByRole("link", { name: /App Store|下载/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /打开仪表盘|Open Dashboard/i }).first(),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "mobile-app");
      return;
    }

    case "/oauth/authorize": {
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", { name: /OAuth|授权|Authorize/i }),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "oauth-authorize");
      return;
    }

    case "/oauth/device": {
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      await expect(
        page.locator('input#code, input[type="text"][name="code"]').first(),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "oauth-device");
      return;
    }

    case "/privacy": {
      await gotoContractPage(page, routePath, testInfo);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("h2").first()).toBeVisible();
      await expect(page.locator("li").first()).toBeVisible();
      await maybeCapture(page, testInfo, "privacy");
      return;
    }

    case "/account/settings": {
      await signInAsDebugUser(page, "/account/settings/profile");
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", { name: /设置|Settings/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /个人资料|Profile/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /账号关联|Accounts/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /危险区|Danger/i }),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "settings");
      return;
    }

    case "/terms": {
      await gotoContractPage(page, routePath, testInfo);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("h2").first()).toBeVisible();
      await expect(page.locator("li").first()).toBeVisible();
      await maybeCapture(page, testInfo, "terms");
      return;
    }

    case "/account/welcome": {
      await expectRequiresSignIn(page, routePath);
      await maybeCapture(page, testInfo, "welcome");
      return;
    }

    case "/": {
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /先从公开校园工具开始|Start with public campus tools/i,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /浏览课程|Browse courses/i }),
      ).toBeVisible();
      await expect(page.getByTestId("bus-compact-summary")).toHaveCount(0);
      await maybeCapture(page, testInfo, "home");
      return;
    }

    case "/api/docs/tag/sections": {
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      await waitForUiSettled(page);
      await expect(page.locator("#api-reference")).toBeVisible();
      await maybeCapture(page, testInfo, "api-docs");
      return;
    }

    case "/error": {
      await gotoContractPage(page, "/error?error=consent_failed", testInfo);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", {
          name: /授权错误|Authorization Error/i,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /返回首页|Return home/i }),
      ).toBeVisible();
      return;
    }

    case "/e2e/oauth/callback": {
      await gotoContractPage(
        page,
        "/e2e/oauth/callback?code=e2e-test-code&state=e2e-test-state",
        testInfo,
      );
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", { name: /OAuth E2E Callback/i }),
      ).toBeVisible();
      await expect(
        page.locator("pre").getByText('"code": "e2e-test-code"'),
      ).toBeVisible();
      return;
    }

    default: {
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
    }
  }
}
