import { expect, type Page, type TestInfo } from "@playwright/test";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
  signInAsDevAdmin,
} from "../../../utils/auth";
import { DEV_SEED } from "../../../utils/dev-seed";
import { getCurrentSessionUser } from "../../../utils/e2e-db";
import {
  expandDashboardSidebarGroup,
  sidebarDashboardLink,
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
  if (routePath.startsWith("/settings/")) {
    if (routePath === "/settings") {
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
    routePath === "/dashboard/[tab]" ||
    routePath.startsWith("/dashboard/") ||
    routePath === "/dashboard"
  ) {
    await signInAsDebugUser(page, routePath === "/dashboard" ? "/" : routePath);
    await gotoContractPage(page, routePath, testInfo);
    await expectMainContent(page);
    await expandDashboardSidebarGroup(page);
    await expect(
      sidebarDashboardLink(page, /^(工作台首页|Workspace start)$/i),
    ).toBeVisible({ timeout: 10_000 });
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

    case "/sections/[jwId]": {
      await gotoContractPage(
        page,
        `/sections/${DEV_SEED.section.jwId}`,
        testInfo,
      );
      await expectMainContent(page);
      await expect(visibleText(page, DEV_SEED.section.code)).toBeVisible();
      await expect(visibleText(page, DEV_SEED.course.nameCn)).toBeVisible();
      await maybeCapture(page, testInfo, "sections-jwId");
      return;
    }

    case "/courses/[jwId]": {
      await gotoContractPage(
        page,
        `/courses/${DEV_SEED.course.jwId}`,
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
      await maybeCapture(page, testInfo, "courses-jwId");
      return;
    }

    case "/teachers/[id]": {
      await gotoContractPage(
        page,
        `/teachers/${await resolveSeedTeacherId(page)}`,
        testInfo,
      );
      await expectMainContent(page);
      await expect(visibleText(page, DEV_SEED.teacher.nameCn)).toBeVisible();
      await expect(
        page
          .getByTestId("detail-section-nav")
          .getByRole("link", { name: /授课班级|Teaching Sections/i }),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "teachers-id");
      return;
    }

    case "/u/[username]": {
      await gotoContractPage(page, `/u/${DEV_SEED.adminUsername}`, testInfo);
      await expectMainContent(page);
      await expect(visibleText(page, DEV_SEED.adminName)).toBeVisible();
      await expect(
        visibleText(page, `@${DEV_SEED.adminUsername}`),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "u-username");
      return;
    }

    case "/u/id/[uid]": {
      await signInAsDevAdmin(page, "/");
      const sessionUser = await getCurrentSessionUser(page);
      await gotoContractPage(page, `/u/id/${sessionUser.id}`, testInfo);
      await expectMainContent(page);
      await expect(
        visibleText(page, `@${DEV_SEED.adminUsername}`),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "u-id-uid");
      return;
    }

    case "/comments/[id]": {
      await signInAsDebugUser(page);
      const sectionId = await resolveSeedSectionId(page);
      const createResponse = await page.request.post("/api/comments", {
        data: {
          targetType: "section",
          targetId: String(sectionId),
          body: "e2e mapped route comment",
        },
      });
      expect(createResponse.status()).toBe(200);
      const createBody = (await createResponse.json()) as { id?: string };
      expect(createBody.id).toBeTruthy();

      await gotoContractPage(page, `/comments/${createBody.id}`, testInfo);
      await expect(page).toHaveURL(
        new RegExp(
          `/sections/${DEV_SEED.section.jwId}/comments(?:\\?.*)?#comment-${createBody.id}$`,
        ),
      );
      await expectMainContent(page);
      await maybeCapture(page, testInfo, "comments-id");
      return;
    }

    case "/comments/guide": {
      await gotoContractPage(page, "/guides/markdown-support", testInfo);
      await expect(page.locator("#main-content")).toBeVisible();
      await expect(page.locator("pre").first()).toBeVisible();
      await expect(page.locator("table").first()).toBeVisible();
      await maybeCapture(page, testInfo, "comments-guide");
      return;
    }

    case "/signin": {
      await gotoContractPage(page, routePath, testInfo);
      await expect(page.getByRole("button", { name: /USTC/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /GitHub/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Google/i })).toBeVisible();
      await maybeCapture(page, testInfo, "signin");
      return;
    }

    case "/bus-map": {
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      await expect(page.locator("svg").first()).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Refresh|刷新/i }),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "bus-map");
      return;
    }

    case "/sections": {
      await gotoContractPage(
        page,
        `/sections?search=${encodeURIComponent(DEV_SEED.section.code)}`,
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

    case "/teachers": {
      await gotoContractPage(
        page,
        `/teachers?search=${encodeURIComponent(DEV_SEED.teacher.nameCn)}`,
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

    case "/courses": {
      await gotoContractPage(
        page,
        `/courses?search=${encodeURIComponent(DEV_SEED.course.code)}`,
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

    case "/settings": {
      await signInAsDebugUser(page, "/settings");
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

    case "/welcome": {
      await expectRequiresSignIn(page, routePath);
      await maybeCapture(page, testInfo, "welcome");
      return;
    }

    case "/": {
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      // Public home defaults to bus tab with bus+links grouped as public queries
      await expect(
        page.getByRole("link", { name: /^(校车|Shuttle Bus)$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /^(网站|Websites)$/i }),
      ).toBeVisible();
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
