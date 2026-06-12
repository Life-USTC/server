import { createHash } from "node:crypto";
import * as path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { DEV_SEED } from "../../seed/dev-seed";
import {
  assertNoSnapshotErrors,
  nowIso,
  relativeFromRoot,
  resetDirectory,
  resolveSnapshotBase,
  resolveSnapshotRoot,
  sanitizeFileSegment,
  sha256File,
  writeJsonFile,
  writeTextFile,
} from "./artifact-utils";
import {
  API_SNAPSHOT_CASES,
  type ApiSnapshotCase,
  MCP_SNAPSHOT_CASES,
  PAGE_SNAPSHOT_CASES,
  type PageSnapshotAction,
  type PageSnapshotCase,
  type SnapshotAuth,
} from "./snapshot-cases";
import {
  cleanupSnapshotOAuthClients,
  createAuthedPage,
  createSnapshotOAuthClientName,
  disconnectSnapshotOAuthCleanup,
  launchSnapshotBrowser,
  signInForSnapshot,
} from "./snapshot-runtime";

async function requestForAuth(
  requests: Map<SnapshotAuth, APIRequestContext>,
  auth: SnapshotAuth,
) {
  const request = requests.get(auth);
  if (!request) throw new Error(`Missing request context for ${auth}`);
  return request;
}

async function resolveApiPath(
  request: APIRequestContext,
  snapshotCase: ApiSnapshotCase,
) {
  if (!snapshotCase.resolvePath) return snapshotCase.path;

  const response = await request.post("/api/sections/match-codes", {
    data: { codes: [snapshotCase.resolvePath.sectionCode] },
  });
  const body = (await response.json()) as {
    sections?: Array<{ id?: number; code?: string | null }>;
  };
  const sectionId = body.sections?.find(
    (section) => section.code === snapshotCase.resolvePath?.sectionCode,
  )?.id;
  if (!sectionId) throw new Error("Unable to resolve seed section id");

  return snapshotCase.resolvePath.target.replace(
    "__section_id__",
    `${sectionId}`,
  );
}

function stableResponseHeaders(headers: Record<string, string>) {
  const volatileHeaders = new Set([
    "date",
    "etag",
    "x-matched-path",
    "x-middleware-rewrite",
    "x-powered-by",
    "x-request-id",
    "x-vercel-cache",
    "x-vercel-id",
  ]);
  return Object.fromEntries(
    Object.entries(headers)
      .filter(([key]) => !volatileHeaders.has(key.toLowerCase()))
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

async function captureApiSnapshots() {
  const baseUrl = "http://127.0.0.1:3000";
  const root = resolveSnapshotRoot("api");
  const browser = await launchSnapshotBrowser();
  const contexts = new Map<
    SnapshotAuth,
    Awaited<ReturnType<typeof browser.newContext>>
  >();
  const requests = new Map<SnapshotAuth, APIRequestContext>();
  const entries: Array<Record<string, unknown>> = [];
  await resetDirectory(root);

  try {
    for (const auth of ["public", "debug", "admin"] as const) {
      const context = await browser.newContext({ baseURL: baseUrl });
      contexts.set(auth, context);
      if (auth !== "public") {
        const page = await createAuthedPage(context, auth);
        await page.close();
      }
      requests.set(auth, context.request);
    }

    for (const snapshotCase of API_SNAPSHOT_CASES) {
      const startedAt = performance.now();
      const dir = path.join(root, sanitizeFileSegment(snapshotCase.id));
      await resetDirectory(dir);
      const request = await requestForAuth(requests, snapshotCase.auth);
      try {
        const requestedPath = await resolveApiPath(request, snapshotCase);
        const response =
          snapshotCase.method === "GET"
            ? await request.get(requestedPath, {
                headers: snapshotCase.headers,
              })
            : await request.post(requestedPath, {
                data: snapshotCase.data,
                headers: snapshotCase.headers,
              });
        const contentType = response.headers()["content-type"] ?? "";
        const text = await response.text();
        let body: unknown = text;
        if (contentType.includes("application/json")) {
          body = text ? JSON.parse(text) : null;
        }

        const responsePath = path.join(dir, "response.json");
        await writeJsonFile(responsePath, {
          id: snapshotCase.id,
          request: {
            method: snapshotCase.method,
            path: requestedPath,
            pathTemplate: snapshotCase.path,
            auth: snapshotCase.auth,
            data: snapshotCase.data,
            expectedStatus: snapshotCase.expectedStatus,
          },
          response: {
            status: response.status(),
            ok: response.ok(),
            headers: stableResponseHeaders(response.headers()),
            body,
          },
        });
        if (!contentType.includes("application/json")) {
          await writeTextFile(path.join(dir, "response.txt"), text);
        }

        const metadata = {
          id: snapshotCase.id,
          kind: "api",
          method: snapshotCase.method,
          path: requestedPath,
          pathTemplate: snapshotCase.path,
          auth: snapshotCase.auth,
          status: response.status(),
          expectedStatus: snapshotCase.expectedStatus,
          ok: response.ok(),
          contentType,
          note: snapshotCase.note,
          durationMs: Math.round(performance.now() - startedAt),
          response: relativeFromRoot(responsePath),
          responseSha256: await sha256File(responsePath),
        };
        await writeJsonFile(path.join(dir, "metadata.json"), metadata);
        entries.push(metadata);
        console.log(`api ${snapshotCase.id}: ${metadata.status}`);
      } catch (error) {
        const metadata = {
          id: snapshotCase.id,
          kind: "api",
          method: snapshotCase.method,
          path: snapshotCase.path,
          auth: snapshotCase.auth,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Math.round(performance.now() - startedAt),
        };
        await writeJsonFile(path.join(dir, "metadata.json"), metadata);
        entries.push(metadata);
        console.error(`api ${snapshotCase.id}: failed`);
      }
    }
  } finally {
    for (const context of contexts.values()) {
      await context.close();
    }
    await browser.close();
  }

  await writeJsonFile(path.join(root, "manifest.json"), {
    kind: "api",
    baseUrl,
    generatedAt: nowIso(),
    count: entries.length,
    entries,
  });
  assertNoSnapshotErrors("api", entries);
}

function generateCodeChallenge(codeVerifier: string) {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function textContentFromResult(result: unknown) {
  const content = isRecord(result) ? result.content : undefined;
  if (!Array.isArray(content)) return undefined;
  const text = content.find(
    (entry): entry is { type: "text"; text: string } =>
      isRecord(entry) &&
      entry.type === "text" &&
      typeof entry.text === "string",
  );
  return text?.text;
}

async function authorizeMcp(baseUrl: string) {
  const publicOrigin = baseUrl;
  const endpoint = `${baseUrl}/api/mcp`;
  const resource = `${publicOrigin.replace(/\/$/, "")}/api/mcp`;
  const redirectUri = `${baseUrl}/e2e/oauth/callback`;
  const headers = { Origin: baseUrl, Referer: `${baseUrl}/` };
  const browser = await launchSnapshotBrowser();
  const context = await browser.newContext({ baseURL: baseUrl });
  const page = await context.newPage();

  try {
    await page.goto(`/signin?callbackUrl=${encodeURIComponent("/")}`);
    await page
      .getByRole("button", { name: /Debug User \(Dev\)|调试用户（开发）/i })
      .first()
      .click();
    await page.waitForURL("**/");

    const registerRes = await page.request.post("/api/auth/oauth2/register", {
      data: {
        client_name: createSnapshotOAuthClientName(),
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
        scope: "openid profile mcp:tools",
      },
      headers,
    });
    if (registerRes.status() !== 200) {
      throw new Error(
        `OAuth register failed: ${registerRes.status()} ${await registerRes.text()}`,
      );
    }
    const { client_id: clientId } = (await registerRes.json()) as {
      client_id?: string;
    };
    if (!clientId) throw new Error("OAuth register response missing client_id");

    const codeVerifier =
      "mcp-snapshot-public-client-verifier-012345678901234567890123456";
    const authorizeRes = await page.request.get("/api/auth/oauth2/authorize", {
      params: {
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "openid profile mcp:tools",
        state: `mcp-snapshot-state-${Date.now()}`,
        prompt: "consent",
        code_challenge: generateCodeChallenge(codeVerifier),
        code_challenge_method: "S256",
        resource,
      },
      maxRedirects: 0,
      headers,
    });
    if (authorizeRes.status() !== 302) {
      throw new Error(
        `OAuth authorize failed: ${authorizeRes.status()} ${await authorizeRes.text()}`,
      );
    }

    const approveByText = page.getByRole("button", {
      name: /allow|approve|authorize|同意|允许|授权/i,
    });
    const debugLogin = page
      .getByRole("button", { name: /Debug User \(Dev\)|调试用户（开发）/i })
      .first();
    await page.goto(authorizeRes.headers().location ?? "");
    const nextVisible = await Promise.race([
      approveByText
        .first()
        .waitFor({ state: "visible", timeout: 60_000 })
        .then(() => "approve" as const)
        .catch(() => undefined),
      debugLogin
        .waitFor({ state: "visible", timeout: 60_000 })
        .then(() => "login" as const)
        .catch(() => undefined),
    ]);
    if (nextVisible === "login") {
      await debugLogin.waitFor({ state: "visible", timeout: 60_000 });
      await debugLogin.click({ timeout: 60_000 });
    } else if (nextVisible !== "approve") {
      throw new Error(
        "OAuth consent page did not show approve or login action",
      );
    }

    const approve = approveByText.first();
    await approve.waitFor({ state: "visible", timeout: 60_000 });
    await approve.click({ timeout: 60_000 });
    await page.waitForURL("**/e2e/oauth/callback**", { timeout: 120_000 });

    const code = new URL(page.url()).searchParams.get("code");
    if (!code) throw new Error("OAuth callback missing code");

    const tokenRes = await page.request.post("/api/auth/oauth2/token", {
      form: {
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        resource,
      },
      headers,
    });
    if (tokenRes.status() !== 200) {
      throw new Error(
        `OAuth token failed: ${tokenRes.status()} ${await tokenRes.text()}`,
      );
    }
    const { access_token: accessToken } = (await tokenRes.json()) as {
      access_token?: string;
    };
    if (!accessToken) throw new Error("OAuth token response missing token");

    return { accessToken, endpoint, resource };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function captureMcpSnapshots() {
  const baseUrl = "http://127.0.0.1:3000";
  const root = resolveSnapshotRoot("mcp");
  await cleanupSnapshotOAuthClients();
  const { accessToken, endpoint, resource } = await authorizeMcp(baseUrl);
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const mcpClient = new Client({
    name: "life-ustc-mcp-snapshot",
    version: "1.0.0",
  });
  const entries: Array<Record<string, unknown>> = [];
  await resetDirectory(root);

  try {
    await mcpClient.connect(transport);
    const toolsDir = path.join(root, "_tools");
    await resetDirectory(toolsDir);
    const toolsPath = path.join(toolsDir, "list-tools.json");
    const listed = await mcpClient.listTools();
    await writeJsonFile(toolsPath, listed);
    entries.push({
      id: "list-tools",
      kind: "mcp",
      response: relativeFromRoot(toolsPath),
      responseSha256: await sha256File(toolsPath),
      toolCount: listed.tools.length,
    });

    for (const snapshotCase of MCP_SNAPSHOT_CASES) {
      const startedAt = performance.now();
      const dir = path.join(root, sanitizeFileSegment(snapshotCase.name));
      await resetDirectory(dir);
      try {
        const result = await mcpClient.callTool({
          name: snapshotCase.name,
          arguments: snapshotCase.arguments,
        });
        const text = textContentFromResult(result);
        let parsedText: unknown = text;
        if (text) {
          try {
            parsedText = JSON.parse(text);
          } catch {
            parsedText = text;
          }
        }

        const responsePath = path.join(dir, "response.json");
        await writeJsonFile(responsePath, {
          tool: snapshotCase.name,
          arguments: snapshotCase.arguments,
          result,
          parsedText,
        });
        const metadata = {
          id: snapshotCase.name,
          kind: "mcp",
          arguments: snapshotCase.arguments,
          note: snapshotCase.note,
          durationMs: Math.round(performance.now() - startedAt),
          response: relativeFromRoot(responsePath),
          responseSha256: await sha256File(responsePath),
        };
        await writeJsonFile(path.join(dir, "metadata.json"), metadata);
        entries.push(metadata);
        console.log(`mcp ${snapshotCase.name}: ok`);
      } catch (error) {
        const metadata = {
          id: snapshotCase.name,
          kind: "mcp",
          arguments: snapshotCase.arguments,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Math.round(performance.now() - startedAt),
        };
        await writeJsonFile(path.join(dir, "metadata.json"), metadata);
        entries.push(metadata);
        console.error(`mcp ${snapshotCase.name}: failed`);
      }
    }
  } finally {
    await transport.close();
    await cleanupSnapshotOAuthClients().catch(() => undefined);
    await disconnectSnapshotOAuthCleanup();
  }

  await writeJsonFile(path.join(root, "manifest.json"), {
    kind: "mcp",
    baseUrl,
    endpoint,
    resource,
    generatedAt: nowIso(),
    count: entries.length,
    entries,
  });
  assertNoSnapshotErrors("mcp", entries);
}

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

async function resolvePagePath(page: Page, snapshotCase: PageSnapshotCase) {
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

  const homeworkDetailTrigger = page
    .locator('[id^="homework-"] button[aria-expanded]')
    .first();
  await expect(homeworkDetailTrigger).toBeVisible({ timeout: 10_000 });
  await homeworkDetailTrigger.click();
  await expect(page.locator('[data-slot="dialog-popup"]').first()).toBeVisible({
    timeout: 10_000,
  });

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

async function capturePageSnapshots() {
  const baseUrl = "http://127.0.0.1:3000";
  const root = resolveSnapshotRoot("pages");
  await cleanupSnapshotOAuthClients();
  const browser = await launchSnapshotBrowser();

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
        const requestedPath = await resolvePagePath(page, snapshotCase);
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

const allSnapshotModes = ["pages", "api", "mcp"] as const;

async function captureAllSnapshots() {
  const root = resolveSnapshotBase();
  const failures: Error[] = [];

  for (const label of allSnapshotModes) {
    try {
      if (label === "pages") await capturePageSnapshots();
      else if (label === "api") await captureApiSnapshots();
      else await captureMcpSnapshots();
    } catch (error) {
      failures.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  await writeJsonFile(path.join(root, "manifest.json"), {
    kind: "snapshots",
    generatedAt: nowIso(),
    children: allSnapshotModes.map((label) => ({
      kind: label,
      manifest: path.join(label, "manifest.json"),
    })),
  });

  if (failures.length > 0) {
    throw new Error(failures.map((failure) => failure.message).join("\n"));
  }
}

function captureUsage() {
  return [
    "Usage:",
    "  bun run tools/dev/artifacts/snapshots/snapshot-capture.ts all",
    "  bun run tools/dev/artifacts/snapshots/snapshot-capture.ts pages",
    "  bun run tools/dev/artifacts/snapshots/snapshot-capture.ts api",
    "  bun run tools/dev/artifacts/snapshots/snapshot-capture.ts mcp",
  ].join("\n");
}

async function main() {
  const mode = process.argv[2];

  if (!mode || mode === "all") {
    await captureAllSnapshots();
    return;
  }
  if (mode === "pages") {
    await capturePageSnapshots();
    return;
  }
  if (mode === "api") {
    await captureApiSnapshots();
    return;
  }
  if (mode === "mcp") {
    await captureMcpSnapshots();
    return;
  }

  throw new Error(captureUsage());
}

await main();
