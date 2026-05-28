import { createHash } from "node:crypto";
import * as path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { chromium } from "@playwright/test";
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
import {
  cleanupSnapshotOAuthClients,
  createSnapshotOAuthClientName,
  disconnectSnapshotOAuthCleanup,
} from "./oauth-cleanup";
import { MCP_SNAPSHOT_CASES } from "./snapshot-cases";

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
  const publicOrigin = process.env.APP_PUBLIC_ORIGIN?.trim() || baseUrl;
  const endpoint = `${baseUrl}/api/mcp`;
  const resource = `${publicOrigin.replace(/\/$/, "")}/api/mcp`;
  const redirectUri = `${baseUrl}/e2e/oauth/callback`;
  const headers = { Origin: baseUrl, Referer: `${baseUrl}/` };
  const browser = await chromium.launch();
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

async function main() {
  const baseUrl =
    process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://localhost:3000";
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

await main();
