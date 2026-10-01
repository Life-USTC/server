import { expect, type Page } from "@playwright/test";
import { DEV_SEED } from "../../../../utils/dev-seed";
import {
  expandSidebarGroup,
  sidebarNavigationLink,
} from "../../../../utils/locators";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../utils/page-ready";
import {
  storedPins,
  test,
} from "../../../../utils/personal-preferences-fixture";
import type { PreferenceFlow } from "../../../../utils/preference-flow";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

const PIN_LABEL = /^(?:置顶|Pin)$/i;
const UNPIN_LABEL = /^(?:取消置顶|Unpin)$/i;

async function setLocale(
  page: Page,
  locale: "en-us" | "zh-cn",
  preferenceFlow: PreferenceFlow,
) {
  const response = await preferenceFlow.http(() =>
    page.request.post("/api/account/preferences", {
      headers: preferenceFlow.headers,
      data: { locale },
    }),
  );
  expect(response.status()).toBe(200);
}

async function locateJwPinButton(page: Page) {
  const link = page
    .getByRole("link", { name: /教务系统/i })
    .filter({ visible: true })
    .first();
  await expect(link).toBeVisible();
  await link
    .locator(
      "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' group ')][1]",
    )
    .hover();
  const button = page
    .locator('form[action="/api/workspace/link-pins"]')
    .filter({ visible: true })
    .filter({ has: page.locator('input[name="slug"][value="jw"]') })
    .first()
    .getByRole("button", { name: /置顶|Pin|取消置顶|Unpin/i })
    .filter({ visible: true })
    .first();
  await expect(button).toBeVisible();
  return button;
}

async function clickJwPin(
  page: Page,
  expectedPins: string[],
  preferenceFlow: PreferenceFlow,
) {
  const button = await locateJwPinButton(page);
  const [response] = await Promise.all([
    preferenceFlow.waitForResponse(
      page,
      (response) =>
        response.url().includes("/api/workspace/link-pins") &&
        response.request().method() === "POST",
    ),
    button.click(),
  ]);
  expect(await response.json()).toMatchObject({
    pinnedSlugs: expectedPins,
    error: null,
  });
  return response;
}

test.describe("仪表盘网站链接", () => {
  test("公共 /links 显示搜索和链接，无置顶控件", async ({
    preferenceFlow,
    page,
  }, testInfo) => {
    await preferenceFlow.run(async () => {
      await setLocale(page, "zh-cn", preferenceFlow);
      const response = await gotoAndWaitForReady(page, "/catalog/links");

      expect(response?.status()).toBe(200);
      await expect(page).toHaveURL(/\/links$/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        /\/links$/,
      );
      const searchInput = page.getByRole("searchbox", {
        name: /搜索网站名称、描述或域名|Search by name, description, or domain/i,
      });
      await expect(searchInput).toBeVisible();
      await page.keyboard.press("ControlOrMeta+Shift+K");
      await expect(searchInput).toBeFocused();
      await expect(
        page.getByRole("link", { name: /教务系统/i }).first(),
      ).toBeVisible();

      // No pin forms in public view
      await expect(
        page.locator('form[action="/api/workspace/link-pins"]').first(),
      ).toHaveCount(0);

      await captureStepScreenshot(page, testInfo, "public-workspace-links-tab");
    }, "consume");
  });

  test("旧版 links 查询标签永久重定向到语义路径", async ({
    preferenceFlow,
    page,
  }) => {
    await preferenceFlow.run(async () => {
      const response = await preferenceFlow.http(() =>
        page.request.get("/?tab=links&linkView=list&utm_source=bookmark", {
          headers: preferenceFlow.headers,
          maxRedirects: 0,
        }),
      );

      expect(response.status()).toBe(308);
      expect(response.headers().location).toBe(
        "/catalog/links?linkView=list&utm_source=bookmark",
      );
    }, "consume");
  });

  test("公共英文链接页面在搜索中使用本地化标题", async ({
    preferenceFlow,
    page,
  }, testInfo) => {
    await preferenceFlow.run(async () => {
      await setLocale(page, "en-us", preferenceFlow);

      await gotoAndWaitForReady(page, "/catalog/links");

      const searchInput = page.getByRole("searchbox", {
        name: /Search by name, description, or domain/i,
      });
      await expect(searchInput).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Academic Affairs System/i }).first(),
      ).toBeVisible();

      await expect(async () => {
        await searchInput.click();
        await searchInput.clear();
        await searchInput.pressSequentially("email");
        await expect(
          page.getByRole("link", { name: /USTC Email/i }).first(),
        ).toBeVisible({ timeout: 3_000 });
        await expect(
          page.getByRole("link", { name: /Academic Affairs System/i }),
        ).toHaveCount(0, { timeout: 3_000 });
      }).toPass({
        timeout: 10_000,
        intervals: [250, 500, 1_000],
      });

      await captureStepScreenshot(
        page,
        testInfo,
        "public-workspace-links-en-search",
      );
    }, "consume");
  });

  test("登录后可以导航到链接标签", async ({
    preferenceFlow,
    page,
    pinnedAccount: _account,
  }, testInfo) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(page, "/workspace/overview");
      await expandSidebarGroup(page, /^(校园服务|Campus Services)$/i);

      const linksTab = sidebarNavigationLink(page, /^(网站|Websites)$/i);
      await expect(linksTab).toBeVisible();
      await linksTab.click();

      await expect(page).toHaveURL(/\/catalog\/links$/);
      await expect(
        page.getByRole("searchbox", {
          name: /搜索网站名称、描述或域名|Search by name, description, or domain/i,
        }),
      ).toBeVisible();
      await expect(
        page.locator('input[name="action"][value="unpin"]'),
      ).not.toHaveCount(0);
      expect(
        await page.locator('input[name="action"][value="unpin"]').count(),
      ).toBeGreaterThanOrEqual(DEV_SEED.catalogLinks.overviewLimit);

      await captureStepScreenshot(page, testInfo, "workspace-links-tab");
    }, "consume");
  });

  test("搜索可筛选链接", async ({
    preferenceFlow,
    page,
    account: _account,
  }, testInfo) => {
    await preferenceFlow.run(async () => {
      await setLocale(page, "zh-cn", preferenceFlow);
      await gotoAndWaitForReady(page, "/catalog/links");

      const searchInput = page.getByRole("searchbox", {
        name: /搜索网站名称、描述或域名|Search by name, description, or domain/i,
      });
      await expect(searchInput).toBeVisible();
      await page.keyboard.press("ControlOrMeta+Shift+K");
      await expect(searchInput).toBeFocused();

      // Search for a specific link
      await expect(async () => {
        await searchInput.click();
        await searchInput.clear();
        await searchInput.pressSequentially("邮箱");
        await expect(
          page.getByRole("link", { name: /邮箱/i }).first(),
        ).toBeVisible({ timeout: 3_000 });
        await expect(
          page.getByRole("link", { name: /教务系统/i }).first(),
        ).toHaveCount(0);
      }).toPass({
        timeout: 10_000,
        intervals: [250, 500, 1_000],
      });

      await expect(async () => {
        await searchInput.clear();
        await searchInput.pressSequentially("faculty.ustc.edu.cn");
        await expect(
          page.getByRole("link", { name: /教师个人主页/i }).first(),
        ).toBeVisible({ timeout: 3_000 });
        await expect(
          page.getByRole("link", { name: /教务系统/i }).first(),
        ).toHaveCount(0);
      }).toPass({
        timeout: 10_000,
        intervals: [250, 500, 1_000],
      });

      await captureStepScreenshot(page, testInfo, "workspace-links-search");
    }, "consume");
  });

  for (const initiallyPinned of [false, true]) {
    const name = initiallyPinned
      ? "可以取消已准备链接的置顶并在刷新后保持状态"
      : "可以置顶链接并在刷新后保持状态";
    test(
      name,
      async ({ preferenceFlow, page, account, isolatedWorker }, testInfo) => {
        const db = isolatedWorker.database.owner;
        if (initiallyPinned)
          await preferenceFlow.prepare(() =>
            db.workspaceLinkPin.create({
              data: { userId: account.id, slug: "jw" },
            }),
          );
        await preferenceFlow.run(async () => {
          await setLocale(page, "zh-cn", preferenceFlow);
          expect(await storedPins(db, account.id)).toEqual(
            initiallyPinned ? ["jw"] : [],
          );
          await gotoAndWaitForReady(page, "/catalog/links", {
            testInfo,
            screenshotLabel: "workspace-links",
          });
          await expect(await locateJwPinButton(page)).toHaveAttribute(
            "aria-label",
            initiallyPinned ? UNPIN_LABEL : PIN_LABEL,
          );
          const expectedPins = initiallyPinned ? [] : ["jw"];
          expect(
            (await clickJwPin(page, expectedPins, preferenceFlow)).ok(),
          ).toBe(true);
          await expect(await locateJwPinButton(page)).toHaveAttribute(
            "aria-label",
            initiallyPinned ? PIN_LABEL : UNPIN_LABEL,
          );
          await expect
            .poll(() => storedPins(db, account.id))
            .toEqual(expectedPins);
          await page.reload({ waitUntil: "domcontentloaded" });
          await waitForUiSettled(page);
          await expect(await locateJwPinButton(page)).toHaveAttribute(
            "aria-label",
            initiallyPinned ? PIN_LABEL : UNPIN_LABEL,
          );
          await captureStepScreenshot(
            page,
            testInfo,
            "workspace-links-toggle-request",
          );
        }, "pins");
      },
    );
  }

  for (const pinned of [true, false]) {
    const name = pinned
      ? "搜索重新计算链接时保持置顶状态"
      : "搜索重新计算链接时保持未置顶状态";
    test(
      name,
      async ({ preferenceFlow, page, account, isolatedWorker }, testInfo) => {
        const db = isolatedWorker.database.owner;
        if (pinned)
          await preferenceFlow.prepare(() =>
            db.workspaceLinkPin.create({
              data: { userId: account.id, slug: "jw" },
            }),
          );
        await preferenceFlow.run(async () => {
          await setLocale(page, "zh-cn", preferenceFlow);
          expect(await storedPins(db, account.id)).toEqual(
            pinned ? ["jw"] : [],
          );
          await gotoAndWaitForReady(page, "/catalog/links");
          const searchInput = page.getByRole("searchbox", {
            name: /搜索网站名称、描述或域名|Search by name, description, or domain/i,
          });
          await expect(await locateJwPinButton(page)).toHaveAttribute(
            "aria-label",
            pinned ? UNPIN_LABEL : PIN_LABEL,
          );
          for (const query of ["教务", "教务系统"]) {
            await searchInput.fill(query);
            await expect(await locateJwPinButton(page)).toHaveAttribute(
              "aria-label",
              pinned ? UNPIN_LABEL : PIN_LABEL,
            );
            expect(await storedPins(db, account.id)).toEqual(
              pinned ? ["jw"] : [],
            );
          }
          await captureStepScreenshot(
            page,
            testInfo,
            "workspace-links-pin-search-stable",
          );
        }, "consume");
      },
    );
  }
});

test("页面契约", async ({ preferenceFlow, page }, testInfo) => {
  await preferenceFlow.run(async () => {
    await assertPageContract(page, { routePath: "/catalog/links", testInfo });
  }, "consume");
});
