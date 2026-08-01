import { expect, test } from "@playwright/test";
import { DEV_SEED, DEV_SEED_ANCHOR } from "../../fixtures/dev-seed";
import { signInAsDebugUser } from "../utils/auth";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
} from "../utils/page-ready";
import { ensureSeedSectionSubscription } from "../utils/subscriptions";
import {
  applyVisualMatrixContext,
  isVisualRegressionEnabled,
  syncAuthenticatedLocale,
  VISUAL_MATRIX_LOCALES,
  type VisualMatrixLocale,
} from "./matrix-setup";

const OVERVIEW_WEEK_START = "2026-04-26";

type VisualScreen = {
  id: string;
  path: string;
  requiresAuth?: boolean;
  prepare?: (
    page: import("@playwright/test").Page,
    locale: VisualMatrixLocale,
  ) => Promise<void>;
  assertReady: (
    page: import("@playwright/test").Page,
    locale: VisualMatrixLocale,
  ) => Promise<void>;
};

const VISUAL_SCREENS: VisualScreen[] = [
  {
    id: "shell-home",
    path: "/",
    assertReady: async (page, locale) => {
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await expect(
        page.getByRole("heading", {
          level: 1,
          name:
            locale === "zh-cn"
              ? /先从公开校园工具开始/
              : /start with public campus tools/i,
        }),
      ).toBeVisible();
    },
  },
  {
    id: "catalog-courses",
    path: "/catalog/courses",
    assertReady: async (page, locale) => {
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("searchbox")).toBeVisible();
      await expect(page.getByTestId("catalog-results-summary")).toBeVisible();
      const desktopRow = page
        .locator("table:visible tbody tr")
        .filter({ hasText: DEV_SEED.course.code });
      const mobileCode = page
        .locator('[data-slot="catalog-code"]:visible')
        .filter({ hasText: DEV_SEED.course.code })
        .first();
      if ((await desktopRow.count()) > 0) {
        await expect(desktopRow).toHaveCount(1);
      } else {
        await expect(mobileCode).toBeVisible();
      }
    },
  },
  {
    id: "workspace-overview",
    path: `/workspace/overview?overviewWeek=${OVERVIEW_WEEK_START}`,
    requiresAuth: true,
    prepare: async (page, locale) => {
      await page.clock.setFixedTime(
        new Date(DEV_SEED_ANCHOR.recommendedAtTime),
      );
      await signInAsDebugUser(page, "/workspace/overview");
      await syncAuthenticatedLocale(page, locale);
      await ensureSeedSectionSubscription(page);
    },
    assertReady: async (page, locale) => {
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: locale === "zh-cn" ? /总览/ : /overview/i,
        }),
      ).toBeVisible();
      await expect(page.getByTestId("dashboard-overview-focus")).toBeVisible();
    },
  },
];

test.describe("视觉回归基线矩阵", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !isVisualRegressionEnabled(),
    "Set VISUAL_REGRESSION=1 to run committed screenshot baselines.",
  );

  for (const locale of VISUAL_MATRIX_LOCALES) {
    for (const screen of VISUAL_SCREENS) {
      test(`${screen.id} / ${locale}`, async ({ baseURL, page }) => {
        await applyVisualMatrixContext(page, { baseURL, locale });
        await screen.prepare?.(page, locale);
        await gotoAndWaitForReady(page, screen.path);
        await screen.assertReady(page, locale);
        await expectNoPageHorizontalOverflow(page);
        await expect(page).toHaveScreenshot(`${screen.id}-${locale}.png`);
      });
    }
  }
});
