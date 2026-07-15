import type { TestInfo } from "@playwright/test";
import { expect, type Page } from "@playwright/test";

type GotoOptions = {
  expectMainContent?: boolean;
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  testInfo?: TestInfo;
  screenshotLabel?: string;
};

const GOTO_RETRY_ATTEMPTS = 3;

export async function expectNoPageHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(
    geometry.scrollWidth,
    `Expected page scrollWidth (${geometry.scrollWidth}) not to exceed clientWidth (${geometry.clientWidth})`,
  ).toBeLessThanOrEqual(geometry.clientWidth);
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
  const { expectMainContent = true, waitUntil } = options;

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

  if (expectMainContent) {
    await expect(page.locator("#main-content")).toBeVisible();
  }

  return response;
}
