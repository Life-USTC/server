/**
 * E2E tests for the Public User Profile Page (`/community/users/[identifier]`)
 *
 * ## Data Represented (user.yml → public-profile.display.fields)
 * - user.image (avatar)
 * - user.name (display name)
 * - user.username (@username)
 * - user.createdAt (join date)
 * - user._count.comments (total comments)
 * - user._count.uploads (total uploads)
 * - user._count.homeworksCreated (homeworks created)
 * - weeks[].date (YYYY-MM-DD) / weeks[].count (contribution counts)
 * - totalContributions (aggregate)
 *
 * ## Rules
 * - Raw internal user IDs are not shown on public profiles
 * - The identifier accepts either username or user ID
 * - Public page: no auth required
 *
 * ## Edge Cases
 * - Non-existent username → 404 page with "Home" link
 * - Empty username param → 404
 */
import { expect } from "@playwright/test";
import type { User } from "../../../../../../src/generated/prisma-node/client";
import {
  expectPrivateViewerState,
  preparePrivateViewer,
} from "../../../../utils/authenticated-read-fixture";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { test as privateTest } from "../../../../utils/personal-preferences-fixture";
import { absoluteTestUrl } from "../../../../utils/request-url";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";
import { test } from "./_fixture";

test("user.public-profile-canonical-route", async ({
  preferenceFlow,
  isolatedWorker,
  publicAdminProfile: _publicAdminProfile,
  page,
}) => {
  await preferenceFlow.run(async () => {
    const db = isolatedWorker.database.owner;
    const user = await db.user.findUniqueOrThrow({
      where: { username: DEV_SEED.adminUsername },
      select: { id: true },
    });
    for (const identifier of [
      DEV_SEED.adminUsername,
      DEV_SEED.adminUsername.toUpperCase(),
      user.id,
    ]) {
      await gotoAndWaitForReady(
        page,
        `/community/users/${identifier}?ignored=1`,
      );
      await expect(
        page.getByRole("heading", { level: 1, name: DEV_SEED.adminName }),
      ).toBeVisible();
      const expected = new URL(
        `/community/users/${DEV_SEED.adminUsername}`,
        page.url(),
      ).href;
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        expected,
      );
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
        "content",
        expected,
      );
    }
  });
});

privateTest(
  "user.public-profile-id-addressability",
  async ({ page, isolatedWorker, preferenceFlow, run }) => {
    await run(async () => {
      const db = isolatedWorker.database.owner;
      const users: User[] = [];
      await preferenceFlow.run(async () => {
        const user = await db.user.create({
          data: {
            name: "Public profile without username",
            email: `${crypto.randomUUID()}@profile.test`,
          },
        });
        users.push(user);
        await gotoAndWaitForReady(page, `/community/users/${user.id}`);
        await expect(
          page.getByRole("heading", { level: 1, name: user.name }),
        ).toBeVisible();
        await expect(page).toHaveTitle(`${user.name} - Life@USTC`);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
          "href",
          new URL(`/community/users/${user.id}`, page.url()).href,
        );
      });
      expect(await db.user.findMany()).toEqual(users);
      expect(await db.session.findMany()).toEqual([]);
      expect(await db.auditLog.findMany()).toEqual([]);
    });
  },
);

test.describe("/community/users/[identifier]", () => {
  test("页面契约", async ({
    preferenceFlow,
    publicAdminProfile: _publicAdminProfile,
    page,
  }, testInfo) => {
    await preferenceFlow.run(async () => {
      await assertPageContract(page, {
        routePath: "/community/users/[identifier]",
        testInfo,
      });
    });
  });

  test("显示所有必需的资料字段", async ({
    preferenceFlow,
    publicAdminProfile: _publicAdminProfile,
    page,
  }, testInfo) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(
        page,
        `/community/users/${DEV_SEED.adminUsername}`,
      );

      // user.name (display name)
      await expect(page.getByText(DEV_SEED.adminName).first()).toBeVisible();
      // user.username (@username)
      await expect(
        page.getByText(`@${DEV_SEED.adminUsername}`).first(),
      ).toBeVisible();

      // user.image (avatar) — img element should be present
      await expect(page.locator("img").first()).toBeVisible();

      // user.createdAt — join date label present
      await expect(
        page.getByText(/加入时间|Joined|joined/i).first(),
      ).toBeVisible();

      await captureStepScreenshot(page, testInfo, "u-username/profile-fields");
    });
  });

  test("公开资料页使用固定 Open Graph 图片，不向图片 URL 传递资料字段", async ({
    preferenceFlow,
    publicAdminProfile: _publicAdminProfile,
    page,
  }) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(
        page,
        `/community/users/${DEV_SEED.adminUsername}`,
      );
      const imageContent = await page
        .locator('meta[property="og:image"]')
        .getAttribute("content");
      expect(imageContent).toBeTruthy();
      const imageUrl = new URL(imageContent ?? "");

      expect(imageUrl.pathname).toBe("/open-graph.png");
      expect(imageUrl.search).toBe("");

      const imageResponse = await page.request.get(imageUrl.href);
      expect(imageResponse.status()).toBe(200);
      expect(imageResponse.headers()["content-type"]).toContain("image/png");
    });
  });

  test("显示统计计数器网格", async ({
    preferenceFlow,
    publicAdminProfile: _publicAdminProfile,
    page,
  }, testInfo) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(
        page,
        `/community/users/${DEV_SEED.adminUsername}`,
      );

      const summary = page.locator('[data-slot="card"]').filter({
        has: page.getByRole("heading", { level: 1, name: DEV_SEED.adminName }),
      });
      await expect(summary).toBeVisible();
      for (const label of [
        /^(评论|Comments)$/,
        /^(上传|Uploads)$/,
        /^(创建作业|Created homework)$/,
      ]) {
        await expect(summary.getByText(label, { exact: true })).toBeVisible();
      }
      await expect(summary.getByText(/^(教学班订阅|Sections)$/)).toHaveCount(0);
      const response = await page.request.get(
        `/api/community/users/${DEV_SEED.adminUsername}`,
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).not.toHaveProperty("sectionCount");
      expect(body.user._count).not.toHaveProperty("subscribedSections");

      await captureStepScreenshot(page, testInfo, "u-username/stats-grid");
      await page.setViewportSize({ width: 390, height: 844 });
      for (const label of [
        /^(评论|Comments)$/,
        /^(上传|Uploads)$/,
        /^(创建作业|Created homework)$/,
      ]) {
        await expect(summary.getByText(label, { exact: true })).toBeVisible();
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(390);
      await captureStepScreenshot(
        page,
        testInfo,
        "u-username/stats-grid-mobile",
      );
    });
  });

  test("显示贡献热力图及 totalContributions", async ({
    preferenceFlow,
    publicDebugProfile: _publicDebugProfile,
    page,
  }, testInfo) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(
        page,
        `/community/users/${DEV_SEED.debugUsername}`,
      );

      // totalContributions label or heading
      await expect(page.getByText(/贡献|contribution/i).first()).toBeVisible();

      const heatmapCells = page.locator("[data-profile-contribution-cell]");
      expect(await heatmapCells.count()).toBeGreaterThan(350);
      await expect(heatmapCells.first()).toBeVisible();

      await captureStepScreenshot(
        page,
        testInfo,
        "u-username/contribution-heatmap",
      );
    });
  });

  test("用户名页面不显示内部用户 ID", async ({
    run,
    publicAdminProfile: _publicAdminProfile,
    baseURL,
  }) => {
    await run(async () => {
      // user.yml: public-identity-display rule — internal ids hidden (permission.yml)
      const res = await fetch(
        absoluteTestUrl(`/community/users/${DEV_SEED.adminUsername}`, baseURL),
      );
      expect(res.status).toBe(200);
      const html = await res.text();
      // Internal cuid IDs (26 chars) should not appear in visible page content
      // We check that the URL pattern /u/id/ is not linked from this page
      expect(html).not.toMatch(/\/u\/id\/[a-z0-9]{15,}/);
    });
  });

  test("不存在的用户名返回 404", async ({ preferenceFlow, page }, testInfo) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(
        page,
        "/community/users/non-existing-username",
        {
          expectMainContent: false,
        },
      );
      await expect(page.getByText("404").first()).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /页面不存在|Page Not Found/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /返回首页|Home/i }),
      ).toBeVisible();
      await captureStepScreenshot(page, testInfo, "u-username/404");
    });
  });
});

test.describe("/community/users/[identifier] by ID", () => {
  test("页面契约", async ({
    preferenceFlow,
    publicAdminProfile: _publicAdminProfile,
    page,
  }, testInfo) => {
    await preferenceFlow.run(async () => {
      await assertPageContract(page, {
        routePath: "/community/users/[identifier]",
        testInfo,
      });
    });
  });

  privateTest(
    "内部用户 ID 地址直接解析同一资料页",
    async ({ page, isolatedWorker, preferenceFlow, run }, testInfo) => {
      await run(async () => {
        const viewer = await preferenceFlow.prepare(() =>
          preparePrivateViewer(page, isolatedWorker, true),
        );
        await preferenceFlow.run(async () => {
          await gotoAndWaitForReady(page, "/workspace/overview");
          const sessionResponse = await preferenceFlow.http(() =>
            page.request.get("/api/auth/get-session"),
          );
          expect(sessionResponse.status()).toBe(200);
          const session = (await sessionResponse.json()) as {
            user?: { id?: string };
          };
          expect(session.user?.id).toBeTruthy();

          await gotoAndWaitForReady(
            page,
            `/community/users/${session.user?.id}`,
          );
          await expect(page).toHaveURL(
            new RegExp(`/community/users/${session.user?.id}$`),
          );
          await expect(
            page.getByText(`@${viewer.user.username}`).first(),
          ).toBeVisible();
          await expect(page.getByText(viewer.user.name).first()).toBeVisible();

          await captureStepScreenshot(page, testInfo, "u-id/profile");
        });
        await expectPrivateViewerState(
          isolatedWorker.database.owner,
          viewer,
          [],
        );
      });
    },
  );

  test("不存在的 uid 返回 404", async ({ preferenceFlow, page }, testInfo) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(
        page,
        "/community/users/non-existent-uid-000000000",
        {
          expectMainContent: false,
        },
      );
      await expect(page.getByText("404").first()).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /页面不存在|Page Not Found/i }),
      ).toBeVisible();
      await captureStepScreenshot(page, testInfo, "u-id/404");
    });
  });
});
