import { type APIResponse, expect } from "@playwright/test";
import { DEFAULT_OAUTH_CLIENT_SCOPES } from "@/lib/oauth/constants";
import { MCP_BOOTSTRAP_SCOPE } from "@/lib/oauth/scope-registry";
import { mcpPostOptions } from "../../../../../shared/mcp-http-request";
import {
  DEFAULT_CLIENT_SCOPE,
  expectMcpCorsHeaders,
  issueAccessToken,
  MCP_CLIENT_SCOPE,
  MCP_CLIENT_SCOPES,
} from "../../../../utils/mcp-helpers";
import { test } from "../../../../utils/mcp-worker";
import {
  anonymousProtocolChecks,
  oauthProtocolChecks,
  prepareProtocolAccount,
} from "./protocol-checks";

async function readMcpJsonRpcResponse(response: APIResponse) {
  const body = await response.text();
  if (!response.headers()["content-type"]?.includes("text/event-stream")) {
    return JSON.parse(body) as unknown;
  }

  const data = body
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice("data: ".length);
  if (!data) throw new Error("MCP SSE response did not contain a data event");
  return JSON.parse(data) as unknown;
}

test.describe("/api/mcp - 传输与授权", () => {
  test("/api/mcp 未认证时可以发现服务器能力", { tag: "@MCP/MCP" }, async ({
    isolatedWorker,
    calendarProtocolRun,
  }) => {
    await calendarProtocolRun(async ({ request }) => {
      const response = await request.post(
        "/api/mcp",
        mcpPostOptions({
          data: {
            jsonrpc: "2.0",
            id: 1,
            method: "server/discover",
            params: {},
          },
          headers: {
            Accept: "application/json, text/event-stream",
            "MCP-Protocol-Version": "2026-07-28",
          },
        }),
      );

      expect(response.status()).toBe(200);
      await response.body();
      expect(response.headers()["www-authenticate"]).toBeUndefined();
      await expect(readMcpJsonRpcResponse(response)).resolves.toMatchObject({
        jsonrpc: "2.0",
        result: {
          supportedVersions: ["2026-07-28"],
          resultType: "complete",
          _meta: {
            "io.modelcontextprotocol/serverInfo": expect.objectContaining({
              name: expect.any(String),
            }),
          },
        },
        id: 1,
      });
      return anonymousProtocolChecks(isolatedWorker, [
        ["POST", "/api/mcp", 200],
      ]);
    });
  });

  test("/api/mcp 未认证时可以调用公开 catalog 工具", {
    tag: "@Semester/MCP",
  }, async ({ isolatedWorker, calendarProtocolRun }) => {
    await calendarProtocolRun(async ({ request }) => {
      const now = Date.now();
      const semester = await isolatedWorker.database.owner.semester.create({
        data: {
          jwId: 1_800_000_000,
          code: "MCP-CURRENT",
          nameCn: "MCP 当前学期",
          startDate: new Date(now - 30 * 86_400_000),
          endDate: new Date(now + 30 * 86_400_000),
        },
      });
      const response = await request.post(
        "/api/mcp",
        mcpPostOptions({
          data: {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
              name: "catalog_semester_current",
              arguments: { mode: "default" },
            },
          },
          headers: {
            Accept: "application/json, text/event-stream",
            "MCP-Protocol-Version": "2026-07-28",
          },
        }),
      );

      expect(response.status()).toBe(200);
      await response.body();
      expect(response.headers()["www-authenticate"]).toBeUndefined();
      await expect(readMcpJsonRpcResponse(response)).resolves.toMatchObject({
        jsonrpc: "2.0",
        id: 1,
        result: {
          structuredContent: expect.objectContaining({ success: true }),
        },
      });
      await expect(readMcpJsonRpcResponse(response)).resolves.toMatchObject({
        result: {
          structuredContent: {
            found: true,
            semester: {
              id: semester.id,
              jwId: 1_800_000_000,
              code: "MCP-CURRENT",
              nameCn: "MCP 当前学期",
            },
          },
        },
      });
      return anonymousProtocolChecks(
        isolatedWorker,
        [["POST", "/api/mcp", 200]],
        [semester],
      );
    });
  });

  test("/api/mcp 未认证调用私有工具时返回 OAuth bearer challenge", {
    tag: "@MCP/MCP",
  }, async ({ isolatedWorker, calendarProtocolRun }) => {
    await calendarProtocolRun(async ({ request }) => {
      const response = await request.post(
        "/api/mcp",
        mcpPostOptions({
          data: {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: "workspace_todo_list", arguments: {} },
          },
          headers: { "MCP-Protocol-Version": "2026-07-28" },
        }),
      );

      expect(response.status()).toBe(401);
      await response.body();
      expect(response.headers()["www-authenticate"]).toContain(
        "resource_metadata=",
      );
      expect(response.headers()["www-authenticate"]).toContain(
        `scope="${MCP_BOOTSTRAP_SCOPE}"`,
      );
      return anonymousProtocolChecks(isolatedWorker, [
        ["POST", "/api/mcp", 401],
      ]);
    });
  });

  test("/api/mcp 在认证后拒绝超过 64 KiB 的请求体", {
    tag: "@MCP/MCP",
  }, async ({ page, isolatedWorker, calendarProtocolRun }) => {
    await calendarProtocolRun(async ({ request }) => {
      const account = await prepareProtocolAccount(page, isolatedWorker);
      const { oauth } = account;
      const oversizedBody = JSON.stringify("x".repeat(65 * 1024));
      const headers = {
        "Content-Type": "application/json",
        "MCP-Protocol-Version": "2026-07-28",
      };

      const unauthenticatedResponse = await request.post(
        "/api/mcp",
        mcpPostOptions({
          data: oversizedBody,
          headers,
        }),
      );
      expect(unauthenticatedResponse.status()).toBe(413);
      await unauthenticatedResponse.body();

      const resource = `${oauth.worker.origin}/api/mcp`;
      const { clientId, accessToken } = await issueAccessToken(page, request, {
        owner: oauth,
        scope: MCP_CLIENT_SCOPE,
        clientScopes: MCP_CLIENT_SCOPES,
        resource,
      });

      const authenticatedResponse = await request.post(
        "/api/mcp",
        mcpPostOptions({
          data: oversizedBody,
          headers: {
            ...headers,
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );
      expect(authenticatedResponse.status()).toBe(413);
      await authenticatedResponse.body();
      await expect(authenticatedResponse.json()).resolves.toMatchObject({
        error: { code: -32000 },
        id: null,
        jsonrpc: "2.0",
      });
      return oauthProtocolChecks(account, {
        clientId,
        storedGrantBinding: false,
        consentScopes: [MCP_CLIENT_SCOPES],
        resources: [resource],
        tokenRequests: 1,
        requests: [
          ["POST", "/api/mcp", 413],
          ["POST", "/api/mcp", 413],
        ],
        refreshTokens: [],
        accessTokens: [],
      });
    });
  });

  test("/api/mcp 在工具执行前拒绝 JSON-RPC batch", {
    tag: "@MCP/MCP",
  }, async ({ page, isolatedWorker, calendarProtocolRun }) => {
    await calendarProtocolRun(async ({ request }) => {
      const account = await prepareProtocolAccount(page, isolatedWorker);
      const { oauth } = account;
      const resource = `${oauth.worker.origin}/api/mcp`;
      const { clientId, accessToken } = await issueAccessToken(page, request, {
        owner: oauth,
        scope: MCP_CLIENT_SCOPE,
        clientScopes: MCP_CLIENT_SCOPES,
        resource,
      });

      const response = await request.post(
        "/api/mcp",
        mcpPostOptions({
          data: Array.from({ length: 2 }, (_, id) => ({
            id,
            jsonrpc: "2.0",
            method: "tools/list",
          })),
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "MCP-Protocol-Version": "2026-07-28",
          },
        }),
      );

      expect(response.status()).toBe(400);
      await response.body();
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: -32600,
          message: "Invalid Request",
        },
        id: null,
        jsonrpc: "2.0",
      });
      return oauthProtocolChecks(account, {
        clientId,
        storedGrantBinding: false,
        consentScopes: [MCP_CLIENT_SCOPES],
        resources: [resource],
        tokenRequests: 1,
        requests: [["POST", "/api/mcp", 400]],
        refreshTokens: [],
        accessTokens: [],
      });
    });
  });

  test("/api/mcp stateless transport does not hold a GET SSE stream", {
    tag: "@MCP/MCP",
  }, async ({ isolatedWorker, calendarProtocolRun }) => {
    await calendarProtocolRun(async ({ request }) => {
      const response = await request.get("/api/mcp", {
        headers: {
          Accept: "text/event-stream",
        },
      });

      expect(response.status()).toBe(405);
      await response.body();
      expect(response.headers().allow).toBe("POST, OPTIONS");
      await expect(response.json()).resolves.toEqual({
        error: "method_not_allowed",
      });
      return anonymousProtocolChecks(isolatedWorker, [
        ["GET", "/api/mcp", 405],
      ]);
    });
  });

  test("/api/mcp 支持受信任浏览器来源的预检和 transport CORS headers", {
    tag: "@MCP/MCP",
  }, async ({ page, isolatedWorker, calendarProtocolRun }) => {
    await calendarProtocolRun(async ({ request }) => {
      const account = await prepareProtocolAccount(page, isolatedWorker);
      const { oauth } = account;
      const origin = oauth.worker.origin.replace("localhost", "127.0.0.1");
      const discoveryPayload = {
        jsonrpc: "2.0",
        id: 1,
        method: "server/discover",
        params: {},
      };

      const preflight = await request.fetch("/api/mcp", {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers":
            "authorization,content-type,mcp-protocol-version,mcp-method,mcp-name",
        },
      });
      expect(preflight.status()).toBe(204);
      await preflight.body();
      expectMcpCorsHeaders(preflight.headers(), origin);

      const unauthenticatedResponse = await request.post(
        "/api/mcp",
        mcpPostOptions({
          data: discoveryPayload,
          headers: {
            Accept: "application/json, text/event-stream",
            Origin: origin,
            "MCP-Protocol-Version": "2026-07-28",
          },
        }),
      );
      expect(unauthenticatedResponse.status()).toBe(200);
      await unauthenticatedResponse.body();
      expectMcpCorsHeaders(unauthenticatedResponse.headers(), origin);
      expect(
        unauthenticatedResponse.headers()["www-authenticate"],
      ).toBeUndefined();

      const resource = `${oauth.worker.origin}/api/mcp`;
      const { clientId, accessToken } = await issueAccessToken(page, request, {
        owner: oauth,
        scope: MCP_CLIENT_SCOPE,
        clientScopes: MCP_CLIENT_SCOPES,
        resource,
      });

      const authenticatedResponse = await request.post(
        "/api/mcp",
        mcpPostOptions({
          data: discoveryPayload,
          headers: {
            Accept: "application/json, text/event-stream",
            Origin: origin,
            Authorization: `Bearer ${accessToken}`,
            "MCP-Protocol-Version": "2026-07-28",
          },
        }),
      );
      expect(authenticatedResponse.status()).toBe(200);
      await authenticatedResponse.body();
      expectMcpCorsHeaders(authenticatedResponse.headers(), origin);
      return oauthProtocolChecks(account, {
        clientId,
        storedGrantBinding: false,
        consentScopes: [MCP_CLIENT_SCOPES],
        resources: [resource],
        tokenRequests: 1,
        requests: [
          ["OPTIONS", "/api/mcp", 204],
          ["POST", "/api/mcp", 200],
          ["POST", "/api/mcp", 200],
        ],
        refreshTokens: [],
        accessTokens: [],
      });
    });
  });

  test("/api/mcp 拒绝外部 Origin header", { tag: "@MCP/MCP" }, async ({
    page,
    isolatedWorker,
    calendarProtocolRun,
  }) => {
    await calendarProtocolRun(async ({ request }) => {
      const account = await prepareProtocolAccount(page, isolatedWorker);
      const { oauth } = account;
      const origin = "https://evil.example";
      const resource = `${oauth.worker.origin}/api/mcp`;
      const discoveryPayload = {
        jsonrpc: "2.0",
        id: 1,
        method: "server/discover",
        params: {},
      };

      const { clientId, accessToken } = await issueAccessToken(page, request, {
        owner: oauth,
        scope: MCP_CLIENT_SCOPE,
        clientScopes: MCP_CLIENT_SCOPES,
        resource,
      });

      const preflight = await request.fetch("/api/mcp", {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers":
            "authorization,content-type,mcp-protocol-version",
        },
      });
      expect(preflight.status()).toBe(403);
      await preflight.body();
      expect(
        preflight.headers()["access-control-allow-origin"],
      ).toBeUndefined();
      await expect(preflight.json()).resolves.toEqual({
        error: "invalid_origin",
      });

      const response = await request.post(
        "/api/mcp",
        mcpPostOptions({
          data: discoveryPayload,
          headers: {
            Accept: "application/json, text/event-stream",
            Origin: origin,
            Authorization: `Bearer ${accessToken}`,
            "MCP-Protocol-Version": "2026-07-28",
          },
        }),
      );
      expect(response.status()).toBe(403);
      await response.body();
      expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
      await expect(response.json()).resolves.toEqual({
        error: "invalid_origin",
      });
      return oauthProtocolChecks(account, {
        clientId,
        storedGrantBinding: false,
        consentScopes: [MCP_CLIENT_SCOPES],
        resources: [resource],
        tokenRequests: 1,
        requests: [
          ["OPTIONS", "/api/mcp", 403],
          ["POST", "/api/mcp", 403],
        ],
        refreshTokens: [],
        accessTokens: [],
      });
    });
  });

  test("/api/mcp 缺少 feature scope 时返回 insufficient_scope", {
    tag: "@MCP/MCP",
  }, async ({ page, isolatedWorker, calendarProtocolRun }) => {
    await calendarProtocolRun(async ({ request }) => {
      const account = await prepareProtocolAccount(page, isolatedWorker);
      const { oauth } = account;
      const resource = `${oauth.worker.origin}/api/mcp`;

      const { clientId, accessToken } = await issueAccessToken(page, request, {
        owner: oauth,
        scope: DEFAULT_CLIENT_SCOPE,
        clientScopes: [...DEFAULT_OAUTH_CLIENT_SCOPES],
        resource,
      });

      const response = await request.post(
        "/api/mcp",
        mcpPostOptions({
          data: {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: "workspace_todo_list", arguments: {} },
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "MCP-Protocol-Version": "2026-07-28",
          },
        }),
      );

      expect(response.status()).toBe(403);
      await response.body();
      expect(response.headers()["www-authenticate"]).toContain(
        'error="insufficient_scope"',
      );
      expect(response.headers()["www-authenticate"]).toContain(
        MCP_BOOTSTRAP_SCOPE,
      );
      await expect(response.json()).resolves.toEqual({
        error: "insufficient_scope",
      });
      return oauthProtocolChecks(account, {
        clientId,
        storedGrantBinding: false,
        consentScopes: [[...DEFAULT_OAUTH_CLIENT_SCOPES]],
        resources: [resource],
        tokenRequests: 1,
        requests: [["POST", "/api/mcp", 403]],
        refreshTokens: [],
        accessTokens: [],
      });
    });
  });
});
