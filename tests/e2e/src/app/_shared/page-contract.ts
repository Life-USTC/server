import { expect, type Page } from "@playwright/test";
import { expectRequiresSignIn } from "../../../utils/auth";
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
import { resolveSeedTeacherId } from "../../../utils/seed-lookups";
import type { UiQualityAllowlist } from "../../../utils/ui-quality";

type PageContractCase = {
  routePath: string;
};

const API_REFERENCE_UI_QUALITY_EXCEPTIONS = {
  structure: [
    {
      match: /^main: expected exactly one visible main landmark, found 2$/,
      reason:
        "Scalar renders its own main landmark inside the application's documented API reference shell.",
    },
  ],
  "duplicate-id": [
    {
      match: /^#scalar-client-\d+-\d+: 2 elements use the same id$/,
      reason:
        "Scalar duplicates hidden client examples for responsive render modes; the ids are third-party generated.",
    },
  ],
  "invalid-link": [
    {
      match: /^a: visible link has no href$/,
      reason:
        "Scalar renders operation toggles as anchors without hrefs inside its generated API reference DOM.",
    },
  ],
} satisfies UiQualityAllowlist;

const YOUNG_EVENT_DETAIL_UI_QUALITY_EXCEPTIONS = {
  "broken-image": [
    {
      match:
        /^img: visible image (?:did not finish loading|has no decoded pixels): .*\/api\/catalog\/young-events\/[^/]+\/image$/,
      reason:
        "Poster images are proxied lazily from young.ustc.edu.cn on an R2 cache miss; CI network to the origin is not guaranteed.",
    },
  ],
} satisfies UiQualityAllowlist;

function getContractUiQuality(routePath: string): UiQualityAllowlist {
  if (routePath.startsWith("/api/docs")) {
    return API_REFERENCE_UI_QUALITY_EXCEPTIONS;
  }
  if (routePath === "/catalog/young-events/[youngId]") {
    return YOUNG_EVENT_DETAIL_UI_QUALITY_EXCEPTIONS;
  }
  return {};
}

function getContractWaitUntil(routePath: string) {
  if (
    routePath === "/api/docs/tag/catalog-section" ||
    routePath === "/guides/markdown-support"
  ) {
    return "load" as const;
  }
  return "domcontentloaded" as const;
}

async function gotoContractPage(page: Page, path: string) {
  const response = await gotoAndWaitForReady(page, path, {
    browserHealth: {},
    expectMeaningfulContent: true,
    expectNoHorizontalOverflow: true,
    uiQuality: getContractUiQuality(path),
    waitUntil: getContractWaitUntil(path),
  });

  if (response) {
    expect(
      response.ok(),
      `Expected ${path} to resolve to a successful document response, received ${response.status()}`,
    ).toBe(true);
  }

  return response;
}

async function expectMainContent(page: Page) {
  await expect(page.locator("#main-content")).toBeVisible();
}

export async function assertPageContract(
  page: Page,
  { routePath }: PageContractCase,
) {
  if (routePath === "/workspace/uploads") {
    await gotoContractPage(page, routePath);
    await expectMainContent(page);
    await expect(
      page.getByRole("heading", { name: /我的上传|My Uploads/i }),
    ).toBeVisible();
    return;
  }
  if (routePath.startsWith("/account/settings/")) {
    if (routePath === "/account/settings") {
      // handled explicitly below for explicitness
    } else {
      await gotoContractPage(page, routePath);
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
    await gotoContractPage(page, routePath);
    await expect(page).toHaveURL(/\/workspace\/subscriptions(?:\?.*)?$/);
    await expectMainContent(page);
    return;
  }

  if (
    routePath === "/workspace/[tab]" ||
    routePath.startsWith("/workspace/") ||
    routePath === "/workspace"
  ) {
    await gotoContractPage(page, routePath);
    await expectMainContent(page);
    await expandWorkspaceSidebarGroup(page);
    await expect(sidebarNavigationLink(page, /^(今天|Today)$/i)).toBeVisible({
      timeout: 10_000,
    });
    return;
  }

  switch (routePath) {
    case "/admin": {
      await gotoContractPage(page, routePath);
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
      return;
    }

    case "/admin/bus": {
      await gotoContractPage(page, routePath);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", { name: /校车管理|Bus Management/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /导入|Import/i }),
      ).toBeVisible();
      return;
    }

    case "/admin/moderation": {
      await gotoContractPage(page, routePath);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", { name: /内容审核|Moderation/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /评论|Comments/i }),
      ).toBeVisible();
      return;
    }

    case "/admin/oauth": {
      await gotoContractPage(page, routePath);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", { name: /OAuth|OAuth 客户端/i }),
      ).toBeVisible();
      // Header + empty-state both expose Create Client; L1 only needs one.
      await expect(
        page.getByRole("button", { name: /创建客户端|Create Client/i }).first(),
      ).toBeVisible();
      return;
    }

    case "/admin/users": {
      await gotoContractPage(page, routePath);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", {
          name: /用户管理|User Management|用户列表|Users/i,
        }),
      ).toBeVisible();
      await expect(
        page.locator("table, [role='table'], [data-slot='table']"),
      ).toBeVisible();
      return;
    }

    case "/catalog/sections/[jwId]": {
      await gotoContractPage(
        page,
        `/catalog/sections/${DEV_SEED.section.jwId}`,
      );
      await expectMainContent(page);
      await expect(visibleText(page, DEV_SEED.section.code)).toBeVisible();
      await expect(visibleText(page, DEV_SEED.course.nameCn)).toBeVisible();
      await expect(page.locator("#introduction")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /日历|Calendar/i }),
      ).toBeVisible();
      return;
    }

    case "/catalog/courses/[jwId]": {
      await gotoContractPage(page, `/catalog/courses/${DEV_SEED.course.jwId}`);
      await expectMainContent(page);
      await expect(visibleText(page, DEV_SEED.course.nameCn)).toBeVisible();
      await expect(visibleText(page, DEV_SEED.course.code)).toBeVisible();
      await expect(page.locator("#introduction")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /授课班级|Teaching Sections/i }),
      ).toBeVisible();
      return;
    }

    case "/catalog/teachers/[id]": {
      await gotoContractPage(
        page,
        `/catalog/teachers/${await resolveSeedTeacherId(page)}`,
      );
      await expectMainContent(page);
      await expect(visibleText(page, DEV_SEED.teacher.nameCn)).toBeVisible();
      await expect(page.locator("#introduction")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /授课班级|Teaching Sections/i }),
      ).toBeVisible();
      return;
    }

    case "/community/users/[identifier]": {
      await gotoContractPage(
        page,
        `/community/users/${DEV_SEED.adminUsername}`,
      );
      await expectMainContent(page);
      await expect(visibleText(page, DEV_SEED.adminName)).toBeVisible();
      await expect(
        visibleText(page, `@${DEV_SEED.adminUsername}`),
      ).toBeVisible();
      return;
    }

    case "/community/comments/guide": {
      await gotoContractPage(page, "/guides/markdown-support");
      await expect(page.locator("#main-content")).toBeVisible();
      await expect(page.locator("pre").first()).toBeVisible();
      await expect(page.locator("table").first()).toBeVisible();
      return;
    }

    case "/account/sign-in": {
      await gotoContractPage(page, routePath);
      await expect(page.getByRole("button", { name: /USTC/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /GitHub/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Google/i })).toBeVisible();
      return;
    }

    case "/catalog/bus": {
      await gotoContractPage(page, routePath);
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
      return;
    }

    case "/catalog/rooms": {
      await gotoContractPage(page, routePath);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /教室位置|Room location/i,
        }),
      ).toBeVisible();
      await expect(page.getByRole("textbox")).toBeVisible();
      return;
    }

    case "/catalog/weather": {
      await gotoContractPage(page, routePath);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", { level: 1, name: /天气|Weather/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          level: 2,
          name: /本部|Main campus/,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 2, name: /高新校区|Gaoxin campus/ }),
      ).toBeVisible();
      return;
    }

    case "/catalog/young-events": {
      await gotoContractPage(
        page,
        `/catalog/young-events?search=${encodeURIComponent(DEV_SEED.youngEvent.name)}`,
      );
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /第二课堂|Second Classroom/i,
        }),
      ).toBeVisible();
      await expect(visibleText(page, DEV_SEED.youngEvent.name)).toBeVisible();
      return;
    }

    case "/catalog/young-events/[youngId]": {
      await gotoContractPage(
        page,
        `/catalog/young-events/${DEV_SEED.youngEvent.youngId}`,
      );
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: DEV_SEED.youngEvent.name,
        }),
      ).toBeVisible();
      await expect(page.getByTestId("young-event-banner")).toBeVisible();
      await expect(
        page
          .getByTestId("young-event-banner")
          .getByText(DEV_SEED.youngEvent.activityLevel),
      ).toBeVisible();
      return;
    }

    case "/catalog/young-events/calendar": {
      await gotoContractPage(
        page,
        "/catalog/young-events/calendar?view=month&date=2026-05-10",
      );
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /活动日历|Event calendar/i,
        }),
      ).toBeVisible();
      await expect(page.getByTestId("young-calendar")).toBeVisible();
      return;
    }

    case "/catalog/young-events/organizers": {
      await gotoContractPage(page, "/catalog/young-events/organizers");
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", { level: 1, name: /主办方|Organizers/i }),
      ).toBeVisible();
      await expect(page.getByRole("searchbox")).toBeVisible();
      return;
    }

    case "/catalog/young-events/organizers/[organizerId]": {
      await gotoContractPage(
        page,
        "/catalog/young-events/organizers/dev-scenario-young-organizer",
      );
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /学生会|Students'? Union/i,
        }),
      ).toBeVisible();
      return;
    }

    case "/catalog/bus/map": {
      await gotoContractPage(page, routePath);
      await expectMainContent(page);
      await expect(page.locator("svg").first()).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Refresh|刷新/i }),
      ).toBeVisible();
      return;
    }

    case "/catalog/links": {
      await gotoContractPage(page, routePath);
      await expectMainContent(page);
      await expect(
        page.getByRole("searchbox", {
          name: /搜索网站名称、描述或域名|Search by name, description, or domain/i,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /教务系统|Academic Affairs/i }).first(),
      ).toBeVisible();
      return;
    }

    case "/search": {
      await gotoContractPage(page, routePath);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", { name: /搜索|Search/i }),
      ).toBeVisible();
      await expect(page.getByRole("combobox")).toBeVisible();
      return;
    }

    case "/news": {
      await gotoContractPage(page, routePath);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", { level: 1, name: /新闻|News/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("searchbox", { name: /搜索|Search/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("radio", { name: /^(全部|All)$/i }),
      ).toBeVisible();
      const advancedFilters = page.getByRole("button", {
        name: /更多筛选|More filters/i,
      });
      await expect(advancedFilters).toHaveAttribute("aria-expanded", "false");
      await advancedFilters.click();
      await expect(
        page.getByRole("dialog", { name: /更多筛选|More filters/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("group", { name: /^(来源|Sources)$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("group", {
          name: /按组织层级筛选|Filter by organization level/i,
        }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
      await expect(advancedFilters).toBeFocused();
      return;
    }

    case "/news/sources": {
      await gotoContractPage(page, routePath);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /新闻来源目录|News source directory/i,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", {
          name: /返回新闻与通知|Back to news and notices/i,
        }),
      ).toBeVisible();
      return;
    }

    case "/news/[id]": {
      await gotoContractPage(page, "/news");
      const detailLink = page
        .getByRole("list", { name: /校园新闻与通知|Campus News & Notices/i })
        .getByRole("heading")
        .first()
        .getByRole("link");
      await expect(detailLink).toBeVisible();
      await detailLink.click();
      await expect(page).toHaveURL(/\/news\/[^/?]+(?:\?.*)?$/);
      await expectMainContent(page);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      return;
    }

    case "/api/docs": {
      await gotoContractPage(page, routePath);
      await expect(page).toHaveURL(
        /\/api\/docs\/tag\/catalog-section(?:\?.*)?$/,
      );
      await expectMainContent(page);
      return;
    }

    case "/catalog/courses/[jwId]/[section]": {
      await gotoContractPage(
        page,
        `/catalog/courses/${DEV_SEED.course.jwId}/introduction`,
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
      return;
    }

    case "/catalog/teachers": {
      await gotoContractPage(
        page,
        `/catalog/teachers?search=${encodeURIComponent(DEV_SEED.teacher.nameCn)}`,
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
      return;
    }

    case "/catalog/courses": {
      await gotoContractPage(
        page,
        `/catalog/courses?search=${encodeURIComponent(DEV_SEED.course.code)}`,
      );
      await expectMainContent(page);
      await expect(visibleText(page, DEV_SEED.course.nameCn)).toBeVisible();
      return;
    }

    case "/guides/markdown-support": {
      await gotoContractPage(page, routePath);
      await waitForUiSettled(page);
      await expect(page.locator("pre").first()).toBeVisible();
      await expect(page.locator("table").first()).toBeVisible();
      return;
    }

    case "/usage/mobile": {
      await gotoContractPage(page, routePath);
      await expectMainContent(page);
      await expect(
        page.getByRole("link", { name: /App Store|下载/i }),
      ).toBeVisible();
      await expect(
        page.locator('img[src="/images/mobile-app/screenshot-01.png"]').first(),
      ).toBeVisible();
      return;
    }

    case "/usage/bot": {
      await gotoContractPage(page, routePath);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", { name: /Presto/i, level: 1 }),
      ).toBeVisible();
      return;
    }

    case "/usage/mcp": {
      await gotoContractPage(page, routePath);
      await expectMainContent(page);
      await expect(
        page
          .getByRole("button", {
            name: /复制 MCP 端点|Copy MCP endpoint/i,
          })
          .first(),
      ).toBeVisible();
      await expect(
        page.getByRole("link", {
          name: /启用开发者模式|Enable Developer Mode/i,
        }),
      ).toHaveAttribute(
        "href",
        "https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta",
      );
      await expect(
        page.locator('img[src="/images/usage/mcp-use-case.png"]').first(),
      ).toBeVisible();
      return;
    }

    case "/usage/cli": {
      await gotoContractPage(page, routePath);
      await expectMainContent(page);
      await expect(
        page.getByRole("link", { name: /在 GitHub 查看|View on GitHub/i }),
      ).toHaveAttribute("href", "https://github.com/Life-USTC/CLI");
      await expect(
        page.getByText(
          /go install github\.com\/Life-USTC\/CLI\/cmd\/life-ustc@latest/,
        ),
      ).toBeVisible();
      await expect(
        page.getByText(
          /life-ustc catalog course -s "线性代数" --no-interactive --limit 3/,
        ),
      ).toBeVisible();
      return;
    }

    case "/oauth/authorize": {
      // Bare authorize URL (no client_id / PKCE) redirects to sign-in.
      await gotoContractPage(page, routePath);
      await expectMainContent(page);
      await expect(
        page.getByRole("heading", { name: /登录|Sign In/i }),
      ).toBeVisible();
      return;
    }

    case "/oauth/device": {
      await gotoContractPage(page, routePath);
      await expectMainContent(page);
      await expect(
        page.locator('input#code, input[type="text"][name="code"]').first(),
      ).toBeVisible();
      return;
    }

    case "/privacy": {
      await gotoContractPage(page, routePath);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("h2").first()).toBeVisible();
      await expect(page.locator("li").first()).toBeVisible();
      return;
    }

    case "/account/settings": {
      await gotoContractPage(page, routePath);
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
      return;
    }

    case "/terms": {
      await gotoContractPage(page, routePath);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("h2").first()).toBeVisible();
      await expect(page.locator("li").first()).toBeVisible();
      return;
    }

    case "/account/welcome": {
      await expectRequiresSignIn(page, routePath);
      return;
    }

    case "/": {
      await gotoContractPage(page, routePath);
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
      return;
    }

    case "/api/docs/tag/catalog-section": {
      await gotoContractPage(page, routePath);
      await expectMainContent(page);
      await waitForUiSettled(page);
      await expect(page.locator("#api-reference")).toBeVisible();
      return;
    }

    case "/error": {
      await gotoContractPage(page, "/error?error=consent_failed");
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
      await gotoContractPage(page, routePath);
      await expectMainContent(page);
    }
  }
}
