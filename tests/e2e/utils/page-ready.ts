import type { TestInfo } from "@playwright/test";
import { expect, type Page } from "@playwright/test";
import {
  type BrowserHealthAllowlist,
  expectNoFrameworkErrorOverlay,
  observeBrowserHealth,
  unexpectedBrowserIssues,
} from "./browser-health";
import { expectRenderedUiQuality, type UiQualityAllowlist } from "./ui-quality";

type GotoOptions = {
  expectMainContent?: boolean;
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  testInfo?: TestInfo;
  screenshotLabel?: string;
  /** Assert console errors, uncaught page errors, and framework overlays during navigation. */
  browserHealth?: false | BrowserHealthAllowlist;
  /** Assert the main region contains rendered, meaningful UI rather than an empty shell. */
  expectMeaningfulContent?: boolean;
  /** Assert the document itself does not scroll horizontally. */
  expectNoHorizontalOverflow?: boolean;
  /** Assert shared document, asset, link, heading, and control integrity. */
  uiQuality?: false | UiQualityAllowlist;
};

const GOTO_RETRY_ATTEMPTS = 3;

export async function expectNoPageHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => {
    const root = document.documentElement;
    const offenders = Array.from(document.body.querySelectorAll("*"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element:
            element.id.length > 0
              ? `${element.tagName.toLowerCase()}#${element.id}`
              : element.tagName.toLowerCase(),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        };
      })
      .filter(({ left, right }) => right > root.clientWidth + 1 || left < -1)
      .slice(0, 5);

    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      offenders,
    };
  });

  expect(
    geometry.scrollWidth,
    `Expected page scrollWidth (${geometry.scrollWidth}) not to exceed clientWidth (${geometry.clientWidth}) by more than 1px. Possible offenders: ${JSON.stringify(geometry.offenders)}`,
  ).toBeLessThanOrEqual(geometry.clientWidth + 1);
}

export async function expectMeaningfulMainContent(page: Page) {
  const main = page.locator("#main-content");
  await expect(main).toBeVisible();
  await expect(
    main
      .locator(
        "h1, h2, p, a, button, input, textarea, select, img, svg, canvas, table, pre, article, section",
      )
      .filter({ visible: true })
      .first(),
    "Expected #main-content to contain at least one visible content element",
  ).toBeVisible();
}

export async function waitForUiSettled(
  page: Page,
  options: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle";
  } = {},
) {
  await page.waitForLoadState(options.waitUntil ?? "domcontentloaded");
  await page.waitForFunction(
    () => document.documentElement.dataset.lifeUstcHydrated === "true",
    null,
    { timeout: 10_000 },
  );
  await page.waitForFunction(() => !/^Loading\b/i.test(document.title), null, {
    timeout: 10_000,
  });
  await expect(page.locator('[data-slot="page-loading"]:visible')).toHaveCount(
    0,
    {
      timeout: 10_000,
    },
  );
  await expect(page.locator('[data-slot="skeleton"]:visible')).toHaveCount(0, {
    timeout: 10_000,
  });
}

export async function gotoAndWaitForReady(
  page: Page,
  url: string,
  options: GotoOptions = {},
) {
  const {
    browserHealth = false,
    expectMainContent = true,
    expectMeaningfulContent = false,
    expectNoHorizontalOverflow = false,
    uiQuality = false,
    waitUntil,
  } = options;
  const healthObserver =
    browserHealth === false ? null : observeBrowserHealth(page);

  try {
    const loadStateWaitUntil =
      waitUntil === "commit" ? "domcontentloaded" : waitUntil;
    let response: Awaited<ReturnType<Page["goto"]>> | undefined;
    for (let attempt = 1; attempt <= GOTO_RETRY_ATTEMPTS; attempt += 1) {
      try {
        response = await page.goto(url, {
          waitUntil: waitUntil ?? "domcontentloaded",
        });
        break;
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !error.message.includes("net::ERR_ABORTED") ||
          attempt === GOTO_RETRY_ATTEMPTS
        ) {
          throw error;
        }
      }
    }

    await waitForUiSettled(page, { waitUntil: loadStateWaitUntil });

    if (expectMeaningfulContent) {
      await expectMeaningfulMainContent(page);
    } else if (expectMainContent) {
      await expect(page.locator("#main-content")).toBeVisible();
    }

    if (browserHealth !== false) {
      await expectNoFrameworkErrorOverlay(page);
      expect(
        unexpectedBrowserIssues(healthObserver?.issues ?? [], browserHealth),
        "Unexpected browser errors occurred while loading the page",
      ).toEqual([]);
    }

    if (expectNoHorizontalOverflow) {
      await expectNoPageHorizontalOverflow(page);
    }

    if (uiQuality !== false) {
      await expectRenderedUiQuality(page, uiQuality);
    }

    return response;
  } finally {
    healthObserver?.stop();
  }
}
