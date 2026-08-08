import { expect, type Page, type TestInfo } from "@playwright/test";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
  signInAsDevAdmin,
} from "../../../utils/auth";
import { DEV_SEED } from "../../../utils/dev-seed";
import {
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
    routePath === "/api/docs/tag/catalog-section" ||
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
  if (routePath.startsWith("/account/settings/")) {
    if (routePath === "/account/settings") {
      // handled explicitly below for explicitness
    } else {
      await signInAsDebugUser(page, routePath);
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      const expectedTab = routePath.split("/").pop();
      const tabMarker =
        expectedTab === "profile"
          ? page.getByRole("heading", { name: /编辑个人资料|Edit Profile/i })
          : expectedTab === "accounts"
            ? page.getByRole("region", {
                name: /关联账户|Linked accounts/i,
              })
            : expectedTab === "preferences"
              ? page.getByText(/外观|Appearance/i).first()
              : expectedTab === "authorizations"
                ? page.getByRole("region", {
                    name: /已授权的 OAuth 应用|Authorized OAuth applications/i,
                  })
                : expectedTab === "danger"
                  ? page.getByRole("region", {
                      name: /删除账户|Delete Account/i,
                    })
                  : page.getByRole("heading", { name: /设置|Settings/i });
      await expect(
        page.getByRole("heading", { name: /设置|Settings/i, level: 1 }),
      ).toBeVisible();
      await expect(tabMarker).toBeVisible();
      return;
    }
  }

  if (routePath === "/workspace/subscriptions/sections") {
    await signInAsDebugUser(page, "/workspace/subscriptions");
    await gotoContractPage(page, routePath, testInfo);
    await expect(page).toHaveURL(/\/workspace\/subscriptions(?:\?.*)?$/);
    await expectMainContent(page);
    return;
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
      await expect(page).toHaveURL(/\/admin\/users(?:\?.*)?$/);
      await expectMainContent(page);
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
        page.getByRole("link", { name: /校车管理|Bus Management/i }),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "admin-entry");
      return;
    }

    case "/admin/bus": {
      await signInAsDevAdmin(page, "/admin/bus");
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", { name: /校车管理|Bus Management/i }),
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
      // Header + empty-state both expose Create Client; L1 only needs one.
      await expect(
        page.getByRole("button", { name: /创建客户端|Create Client/i }).first(),
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
      await expect(page.locator("#introduction")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /日历|Calendar/i }),
      ).toBeVisible();
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
      await expect(page.locator("#introduction")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /授课班级|Teaching Sections/i }),
      ).toBeVisible();
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
      await expect(page.locator("#introduction")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /授课班级|Teaching Sections/i }),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "teachers-id");
      return;
    }

    case "/community/users/[identifier]": {
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
          `/catalog/sections/${DEV_SEED.section.jwId}#comment-${createBody.id}$`,
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

    case "/catalog/bus": {
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", { level: 1, name: /校车|Shuttle Bus/i }),
      ).toBeVisible();
      // Mobile-only collapsible triggers are lg:hidden; assert desktop planner.
      await expect(
        page.locator("[data-testid='bus-start-stop-group']"),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Reverse|反向/i }),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "bus");
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

    case "/catalog/links": {
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      await expect(
        page.getByRole("searchbox", {
          name: /搜索网站名称或描述|Search by name or description/i,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /教务系统|Academic Affairs/i }).first(),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "links");
      return;
    }

    case "/search": {
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", { name: /搜索|Search/i }),
      ).toBeVisible();
      await expect(page.getByRole("combobox")).toBeVisible();
      await maybeCapture(page, testInfo, "search");
      return;
    }

    case "/api/docs": {
      await gotoContractPage(page, routePath, testInfo);
      await expect(page).toHaveURL(
        /\/api\/docs\/tag\/catalog-section(?:\?.*)?$/,
      );
      await expectMainContent(page);
      await maybeCapture(page, testInfo, "api-docs-redirect");
      return;
    }

    case "/catalog/courses/[jwId]/[section]": {
      await gotoContractPage(
        page,
        `/catalog/courses/${DEV_SEED.course.jwId}/introduction`,
        testInfo,
      );
      await expect(page).toHaveURL(
        new RegExp(`/catalog/courses/${DEV_SEED.course.jwId}#introduction$`),
      );
      await expectMainContent(page);
      return;
    }

    case "/catalog/sections/[jwId]/[section]": {
      await gotoContractPage(
        page,
        `/catalog/sections/${DEV_SEED.section.jwId}/introduction`,
        testInfo,
      );
      await expect(page).toHaveURL(
        new RegExp(`/catalog/sections/${DEV_SEED.section.jwId}#introduction$`),
      );
      await expectMainContent(page);
      return;
    }

    case "/catalog/teachers/[id]/[section]": {
      const teacherId = await resolveSeedTeacherId(page);
      await gotoContractPage(
        page,
        `/catalog/teachers/${teacherId}/introduction`,
        testInfo,
      );
      await expect(page).toHaveURL(
        new RegExp(`/catalog/teachers/${teacherId}#introduction$`),
      );
      await expectMainContent(page);
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
        page.locator('img[src="/images/mobile-app/screenshot-01.png"]').first(),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "mobile-app");
      return;
    }

    case "/oauth/authorize": {
      // Bare authorize URL (no client_id / PKCE) redirects to sign-in.
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", { name: /登录|Sign In/i }),
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
          name: /课程、课表与校园生活，一站搞定|Courses, schedules, and campus life/i,
        }),
      ).toBeVisible();
      await expect(
        page
          .locator("#main-content")
          .getByRole("link", { name: /^(课程|Courses)$/i }),
      ).toBeVisible();
      await expect(page.getByTestId("bus-compact-summary")).toHaveCount(0);
      await maybeCapture(page, testInfo, "home");
      return;
    }

    case "/api/docs/tag/catalog-section": {
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
