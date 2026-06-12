import { appendFile, mkdir } from "node:fs/promises";
import * as path from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import {
  capturePageScreenshot,
  resolveGlobalArtifactsRoot,
} from "./screenshot";

type GotoOptions = {
  expectMainContent?: boolean;
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  testInfo?: TestInfo;
  screenshotLabel?: string;
};

const GOTO_RETRY_ATTEMPTS = 3;

export async function waitForUiSettled(
  page: Page,
  options: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle";
  } = {},
) {
  await page.waitForLoadState(options.waitUntil ?? "domcontentloaded");
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

let timingDirReady: Promise<string> | undefined;

function ensureTimingDir() {
  if (!timingDirReady) {
    const dir = path.join(resolveGlobalArtifactsRoot(), "timings");
    timingDirReady = mkdir(dir, { recursive: true }).then(() => dir);
  }
  return timingDirReady;
}

export async function gotoAndWaitForReady(
  page: Page,
  url: string,
  options: GotoOptions = {},
) {
  const {
    expectMainContent = true,
    waitUntil,
    testInfo,
    screenshotLabel,
  } = options;

  let resolvedTestInfo: TestInfo | undefined = testInfo;
  if (!resolvedTestInfo) {
    try {
      resolvedTestInfo = test.info();
    } catch {
      // Outside a Playwright test (e.g. helper invoked from a script).
    }
  }

  const verbose = false;
  const t0 = performance.now();
  const initialUrl = page.url();
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

  const tGoto = performance.now();
  await waitForUiSettled(page, { waitUntil: loadStateWaitUntil });

  if (expectMainContent) {
    await expect(page.locator("#main-content")).toBeVisible();
  }

  if (verbose && resolvedTestInfo) {
    const tReady = performance.now();
    const finalUrl = page.url();
    const timing = {
      requestedUrl: url,
      initialUrl,
      finalUrl,
      msGoto: Math.round(tGoto - t0),
      msUiSettled: Math.round(tReady - tGoto),
      msTotal: Math.round(tReady - t0),
      status: response?.status(),
    };

    await resolvedTestInfo.attach(`nav-timing:${url}`, {
      body: Buffer.from(JSON.stringify(timing, null, 2)),
      contentType: "application/json",
    });

    const timingDir = await ensureTimingDir();
    const timingLine = JSON.stringify({
      ...timing,
      ts: new Date().toISOString(),
      testTitle: resolvedTestInfo.title,
      file: resolvedTestInfo.file,
    });
    // Per-worker file avoids cross-worker write contention; collected files are
    // concatenated by tooling that ingests the artifacts directory.
    await appendFile(
      path.join(
        timingDir,
        `nav-timings-w${resolvedTestInfo.workerIndex}.ndjson`,
      ),
      `${timingLine}\n`,
    );

    await capturePageScreenshot(page, resolvedTestInfo, {
      url: finalUrl,
      label: screenshotLabel ?? "page",
    });
  }

  return response;
}
