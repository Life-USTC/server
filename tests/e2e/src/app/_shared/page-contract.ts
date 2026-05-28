import { expect, type Page, type TestInfo } from "@playwright/test";
import { signInAsDebugUser } from "../../../utils/auth";
import { DEV_SEED } from "../../../utils/dev-seed";
import { getCurrentSessionUser } from "../../../utils/e2e-db";
import { visibleText } from "../../../utils/locators";
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
  if (routePath === "/api-docs" || routePath === "/guides/markdown-support") {
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
  switch (routePath) {
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
      await expect(visibleText(page, DEV_SEED.section.code)).toBeVisible();
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
      await expect(visibleText(page, DEV_SEED.section.code)).toBeVisible();
      await maybeCapture(page, testInfo, "teachers-id");
      return;
    }

    case "/u/[username]": {
      await gotoContractPage(page, `/u/${DEV_SEED.debugUsername}`, testInfo);
      await expectMainContent(page);
      await expect(visibleText(page, DEV_SEED.debugName)).toBeVisible();
      await expect(
        visibleText(page, `@${DEV_SEED.debugUsername}`),
      ).toBeVisible();
      await maybeCapture(page, testInfo, "u-username");
      return;
    }

    case "/u/id/[uid]": {
      await signInAsDebugUser(page, "/");
      const sessionUser = await getCurrentSessionUser(page);
      await gotoContractPage(page, `/u/id/${sessionUser.id}`, testInfo);
      await expectMainContent(page);
      await expect(
        visibleText(page, `@${DEV_SEED.debugUsername}`),
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
          `/sections/${DEV_SEED.section.jwId}(?:\\?.*)?#comment-${createBody.id}$`,
        ),
      );
      await expectMainContent(page);
      await maybeCapture(page, testInfo, "comments-id");
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

    case "/api-docs": {
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
      await waitForUiSettled(page);
      await expect(page.locator("#swagger-ui")).toBeVisible();
      await maybeCapture(page, testInfo, "api-docs");
      return;
    }

    default: {
      await gotoContractPage(page, routePath, testInfo);
      await expectMainContent(page);
    }
  }
}
