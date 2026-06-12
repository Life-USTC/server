import { mkdir } from "node:fs/promises";
import * as path from "node:path";
import type { Page, TestInfo } from "@playwright/test";

const CAPTURE_STEP_SCREENSHOTS = false;

function sanitizePathSegment(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "_";
  return trimmed
    .replace(/%[0-9A-Fa-f]{2}/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "_");
}

function urlToFolderParts(rawUrl: string) {
  const url = new URL(rawUrl, "http://127.0.0.1:3000");
  const pathname = url.pathname === "/" ? "/_root" : url.pathname;
  const parts = pathname.split("/").filter(Boolean).map(sanitizePathSegment);

  const query = url.searchParams.toString();
  if (query) {
    parts.push("_q", sanitizePathSegment(query));
  }

  if (url.hash) {
    parts.push("_h", sanitizePathSegment(url.hash.replace(/^#/, "")));
  }

  return parts.length > 0 ? parts : ["_root"];
}

export function resolveGlobalArtifactsRoot() {
  return path.join(process.cwd(), "test-results/e2e");
}

const ensuredDirs = new Set<string>();

async function ensureDir(dir: string) {
  if (ensuredDirs.has(dir)) return;
  await mkdir(dir, { recursive: true });
  ensuredDirs.add(dir);
}

let screenshotCounter = 0;

function uniqueScreenshotPath(dir: string, baseName: string, ext: string) {
  // pid + monotonically increasing counter avoids the existsSync probe race
  // when multiple workers write into the same shared screenshots-by-url tree.
  screenshotCounter += 1;
  const safeBase = sanitizePathSegment(baseName);
  return path.join(
    dir,
    `${safeBase}-w${process.pid}-${screenshotCounter}.${ext}`,
  );
}

/**
 * Captures a screenshot and attaches it to the test report.
 *
 * @param page   Playwright page
 * @param testInfo  Playwright TestInfo (for outputPath and attach)
 * @param name   Screenshot name; may include a folder prefix like "section/detail"
 *               which becomes a sub-directory inside the test's output folder.
 */
export async function captureStepScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
) {
  if (!CAPTURE_STEP_SCREENSHOTS) return;

  const parts = name.replace(/[^a-zA-Z0-9\-_/]/g, "-").split("/");
  const fileName = `${parts.pop()}.png`;
  const subDir = parts.length > 0 ? path.join(...parts) : "";

  const baseDir = testInfo.outputPath(subDir);
  await ensureDir(baseDir);

  const filePath = path.join(baseDir, fileName);

  await page.screenshot({
    path: filePath,
    fullPage: true,
  });

  await testInfo.attach(name, {
    path: filePath,
    contentType: "image/png",
  });
}

export async function capturePageScreenshot(
  page: Page,
  testInfo: TestInfo,
  options: {
    url: string;
    label?: string;
  },
) {
  const parts = urlToFolderParts(options.url);
  const label = options.label ? sanitizePathSegment(options.label) : "page";

  const globalBaseDir = path.join(
    resolveGlobalArtifactsRoot(),
    "screenshots-by-url",
    ...parts,
  );
  await ensureDir(globalBaseDir);
  const filePath = uniqueScreenshotPath(globalBaseDir, label, "jpg");

  await page.screenshot({
    path: filePath,
    fullPage: false,
    type: "jpeg",
    quality: 65,
  });

  await testInfo.attach(`screenshot:${options.url}`, {
    path: filePath,
    contentType: "image/jpeg",
  });
}
