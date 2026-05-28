import * as path from "node:path";
import { chromium, expect, type Page } from "@playwright/test";
import { DEV_SEED } from "../../seed/dev-seed";
import {
  assertNoSnapshotErrors,
  nowIso,
  relativeFromRoot,
  resetDirectory,
  resolveSnapshotRoot,
  sanitizeFileSegment,
  sha256File,
  writeJsonFile,
} from "./artifact-utils";
import { signInForSnapshot } from "./auth";
import {
  cleanupSnapshotOAuthClients,
  disconnectSnapshotOAuthCleanup,
} from "./oauth-cleanup";
import {
  PAGE_SNAPSHOT_CASES,
  type PageSnapshotAction,
  type PageSnapshotCase,
} from "./snapshot-cases";

const MAX_ARTIFACT_SEGMENT_LENGTH = 80;
const DESKTOP_VIEWPORT = { width: 1440, height: 1100 } as const;
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

function sanitizeUriSegment(value: string) {
  const segment = sanitizeFileSegment(value);
  if (segment.toLowerCase() === "e2e") return "test-flow";
  return segment.slice(0, MAX_ARTIFACT_SEGMENT_LENGTH);
}

function pageArtifactSegments(uri: string) {
  let url: URL;
  try {
    url = new URL(uri, "http://snapshot.local");
  } catch {
    return [sanitizeUriSegment(uri)];
  }

  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map(sanitizeUriSegment);
  if (segments.length === 0) segments.push("_root");

  const querySegments = [...url.searchParams.entries()].map(([key, value]) =>
    sanitizeUriSegment(`${key}-${value}`),
  );
  if (querySegments.length > 0) {
    segments.push("_query", ...querySegments);
  }

  return segments;
}

function pageArtifactDirectory(
  root: string,
  snapshotCase: PageSnapshotCase,
  uri: string,
) {
  return path.join(
    root,
    ...pageArtifactSegments(uri),
    sanitizeUriSegment(snapshotCase.id),
  );
}

function actionArtifactDirectory(root: string, action: PageSnapshotAction) {
  return path.join(root, "actions", sanitizeUriSegment(action));
}

async function resolvePath(page: Page, snapshotCase: PageSnapshotCase) {
  if (!snapshotCase.resolvePath) return snapshotCase.path;

  if (snapshotCase.resolvePath === "teacher-detail") {
    const response = await page.request.get(
      `/api/teachers?search=${encodeURIComponent(DEV_SEED.teacher.code)}&limit=5`,
    );
    const body = (await response.json()) as {
      data?: Array<{ id?: number; code?: string | null }>;
    };
    const teacherId = body.data?.find(
      (item) => item.code === DEV_SEED.teacher.code,
    )?.id;
    if (!teacherId) throw new Error("Unable to resolve seed teacher id");
    return `/teachers/${teacherId}`;
  }

  if (snapshotCase.resolvePath === "user-id") {
    const response = await page.request.get("/api/me");
    const body = (await response.json()) as { id?: string };
    if (!body.id) throw new Error("Unable to resolve current user id");
    return `/u/id/${body.id}`;
  }

  const sectionResponse = await page.request.post("/api/sections/match-codes", {
    data: { codes: [DEV_SEED.section.code] },
  });
  const sectionBody = (await sectionResponse.json()) as {
    sections?: Array<{ id?: number; code?: string | null }>;
  };
  const sectionId = sectionBody.sections?.find(
    (section) => section.code === DEV_SEED.section.code,
  )?.id;
  if (!sectionId) throw new Error("Unable to resolve seed section id");

  const commentResponse = await page.request.get(
    `/api/comments?targetType=section&targetId=${sectionId}`,
  );
  const commentBody = (await commentResponse.json()) as {
    comments?: Array<{ id?: string; body?: string }>;
  };
  const commentId = commentBody.comments?.find((comment) =>
    comment.body?.includes(DEV_SEED.comments.sectionRootBody),
  )?.id;
  if (!commentId) throw new Error("Unable to resolve seed comment id");
  return `/comments/${commentId}`;
}

async function waitForSnapshotReady(
  page: Page,
  snapshotCase: PageSnapshotCase,
) {
  await page
    .waitForLoadState("networkidle", { timeout: 2_000 })
    .catch(() => undefined);
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
  if (snapshotCase.id === "api-docs") {
    await expect(page.locator("#swagger-ui .opblock").first()).toBeVisible({
      timeout: 10_000,
    });
  } else {
    await expect(page.getByText(/加载中|Loading/i)).toHaveCount(0, {
      timeout: 10_000,
    });
  }
  await page
    .addStyleTag({
      content: `
nextjs-portal,
[data-nextjs-toast],
[data-nextjs-dialog-overlay],
[data-nextjs-dialog] {
  display: none !important;
}
`,
    })
    .catch(() => undefined);
}

async function openTab(page: Page, name: RegExp) {
  const tab = page.getByRole("tab", { name }).first();
  await expect(tab).toBeVisible({ timeout: 10_000 });
  await tab.click();
}

async function performSnapshotAction(page: Page, action: PageSnapshotAction) {
  if (action === "section-calendar-subscription") {
    await openTab(page, /日历|Calendar/i);
    const calendarButton = page
      .getByRole("button", { name: /添加到日历|Add to calendar/i })
      .first();
    await expect(calendarButton).toBeVisible({ timeout: 10_000 });
    await calendarButton.click();
    const dialog = page.locator('[data-slot="dialog-popup"]').first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.locator("#calendar-url")).toBeVisible({
      timeout: 10_000,
    });
    return;
  }

  await openTab(page, /作业|Homework/i);

  if (action === "section-homework-create") {
    const createButton = page
      .getByRole("button", { name: /^新建$|^Create$/i })
      .first();
    await expect(createButton).toBeVisible({ timeout: 10_000 });
    await createButton.click();
    const sheet = page.locator('[data-slot="sheet-popup"]').first();
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await expect(
      sheet.getByRole("heading", { name: /新建作业|New Homework/i }),
    ).toBeVisible({ timeout: 10_000 });
    return;
  }

  const editButton = page
    .getByRole("button", { name: /编辑信息|Edit details/i })
    .first();
  await expect(editButton).toBeVisible({ timeout: 10_000 });
  await editButton.click({ force: true });
  await expect(page.getByLabel(/标题|Title/i).first()).toBeVisible({
    timeout: 10_000,
  });
}

async function captureActionViewport({
  action,
  page,
  requestedPath,
  snapshotCase,
  viewport,
}: {
  action: PageSnapshotAction;
  page: Page;
  requestedPath: string;
  snapshotCase: PageSnapshotCase;
  viewport: typeof DESKTOP_VIEWPORT | typeof MOBILE_VIEWPORT;
}) {
  await page.setViewportSize(viewport);
  await gotoSnapshotPage(page, snapshotCase, requestedPath);
  await waitForSnapshotReady(page, snapshotCase);
  await performSnapshotAction(page, action);
  await waitForSnapshotReady(page, snapshotCase);
  await page.waitForTimeout(350);
}

async function gotoSnapshotPage(
  page: Page,
  snapshotCase: PageSnapshotCase,
  requestedPath: string,
) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await page.goto(requestedPath, {
        waitUntil: snapshotCase.waitUntil ?? "domcontentloaded",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        snapshotCase.auth === "public" ||
        attempt === 2 ||
        !message.includes("/signin")
      ) {
        throw error;
      }
      await signInForSnapshot(page, snapshotCase.auth, requestedPath);
    }
  }
  throw new Error(`Unable to navigate to ${requestedPath}`);
}

async function main() {
  const baseUrl =
    process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://localhost:3000";
  const root = resolveSnapshotRoot("pages");
  await cleanupSnapshotOAuthClients();
  const browser = await chromium.launch();

  const entries: Array<Record<string, unknown>> = [];
  await resetDirectory(root);

  try {
    for (const snapshotCase of PAGE_SNAPSHOT_CASES) {
      const context = await browser.newContext({
        baseURL: baseUrl,
        deviceScaleFactor: 2,
        viewport: DESKTOP_VIEWPORT,
      });
      const page = await context.newPage();
      const startedAt = performance.now();
      let dir = pageArtifactDirectory(root, snapshotCase, snapshotCase.path);
      try {
        await signInForSnapshot(
          page,
          snapshotCase.auth,
          snapshotCase.resolvePath ? "/" : snapshotCase.path,
        );
        const requestedPath = await resolvePath(page, snapshotCase);
        dir = pageArtifactDirectory(root, snapshotCase, requestedPath);
        await resetDirectory(dir);
        const response = await gotoSnapshotPage(
          page,
          snapshotCase,
          requestedPath,
        );
        await waitForSnapshotReady(page, snapshotCase);

        const screenshotPath = path.join(dir, "screenshot.png");
        await page.screenshot({
          path: screenshotPath,
          fullPage: snapshotCase.fullPage ?? true,
        });
        await page.setViewportSize(MOBILE_VIEWPORT);
        await waitForSnapshotReady(page, snapshotCase);

        const mobileScreenshotPath = path.join(dir, "mobile-screenshot.png");
        await page.screenshot({
          path: mobileScreenshotPath,
          fullPage: snapshotCase.fullPage ?? true,
        });

        const metadata = {
          id: snapshotCase.id,
          kind: "page",
          auth: snapshotCase.auth,
          requestedPath,
          pathTemplate: snapshotCase.path,
          finalUrl: page.url(),
          status: response?.status() ?? null,
          ok: response?.ok() ?? null,
          title: await page.title(),
          note: snapshotCase.note,
          durationMs: Math.round(performance.now() - startedAt),
          screenshot: relativeFromRoot(screenshotPath),
          screenshotSha256: await sha256File(screenshotPath),
          mobileScreenshot: relativeFromRoot(mobileScreenshotPath),
          mobileScreenshotSha256: await sha256File(mobileScreenshotPath),
          viewports: {
            desktop: DESKTOP_VIEWPORT,
            mobile: MOBILE_VIEWPORT,
          },
        };
        await writeJsonFile(path.join(dir, "metadata.json"), metadata);
        entries.push(metadata);

        for (const action of snapshotCase.actions ?? []) {
          const actionStartedAt = performance.now();
          const actionDir = actionArtifactDirectory(dir, action);
          await resetDirectory(actionDir);
          try {
            const actionScreenshotPath = path.join(actionDir, "screenshot.png");
            await captureActionViewport({
              action,
              page,
              requestedPath,
              snapshotCase,
              viewport: DESKTOP_VIEWPORT,
            });
            await page.screenshot({
              path: actionScreenshotPath,
              fullPage: false,
            });

            const actionMobileScreenshotPath = path.join(
              actionDir,
              "mobile-screenshot.png",
            );
            await captureActionViewport({
              action,
              page,
              requestedPath,
              snapshotCase,
              viewport: MOBILE_VIEWPORT,
            });
            await page.screenshot({
              path: actionMobileScreenshotPath,
              fullPage: false,
            });

            const actionMetadata = {
              id: `${snapshotCase.id}:${action}`,
              caseId: snapshotCase.id,
              action,
              kind: "page-action",
              auth: snapshotCase.auth,
              requestedPath,
              pathTemplate: snapshotCase.path,
              finalUrl: page.url(),
              title: await page.title(),
              durationMs: Math.round(performance.now() - actionStartedAt),
              screenshot: relativeFromRoot(actionScreenshotPath),
              screenshotSha256: await sha256File(actionScreenshotPath),
              mobileScreenshot: relativeFromRoot(actionMobileScreenshotPath),
              mobileScreenshotSha256: await sha256File(
                actionMobileScreenshotPath,
              ),
              viewports: {
                desktop: DESKTOP_VIEWPORT,
                mobile: MOBILE_VIEWPORT,
              },
            };
            await writeJsonFile(
              path.join(actionDir, "metadata.json"),
              actionMetadata,
            );
            entries.push(actionMetadata);
            console.log(`page ${snapshotCase.id}:${action}: ok`);
          } catch (actionError) {
            await resetDirectory(actionDir);
            const actionMetadata = {
              id: `${snapshotCase.id}:${action}`,
              caseId: snapshotCase.id,
              action,
              kind: "page-action",
              auth: snapshotCase.auth,
              requestedPath,
              pathTemplate: snapshotCase.path,
              error:
                actionError instanceof Error
                  ? actionError.message
                  : String(actionError),
              durationMs: Math.round(performance.now() - actionStartedAt),
            };
            await writeJsonFile(
              path.join(actionDir, "metadata.json"),
              actionMetadata,
            );
            entries.push(actionMetadata);
            console.error(`page ${snapshotCase.id}:${action}: failed`);
          }
        }
        console.log(`page ${snapshotCase.id}: ${metadata.status}`);
      } catch (error) {
        await resetDirectory(dir);
        const metadata = {
          id: snapshotCase.id,
          kind: "page",
          auth: snapshotCase.auth,
          requestedPath: snapshotCase.path,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Math.round(performance.now() - startedAt),
        };
        await writeJsonFile(path.join(dir, "metadata.json"), metadata);
        entries.push(metadata);
        console.error(`page ${snapshotCase.id}: failed`);
      } finally {
        await page.close();
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await disconnectSnapshotOAuthCleanup();
  }

  await writeJsonFile(path.join(root, "manifest.json"), {
    kind: "pages",
    baseUrl,
    generatedAt: nowIso(),
    count: entries.length,
    entries,
  });
  assertNoSnapshotErrors("pages", entries);
}

await main();
