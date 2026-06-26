import { expect, test } from "@playwright/test";
import {
  DEFAULT_OAUTH_CLIENT_SCOPES,
  MCP_TOOLS_SCOPE,
} from "@/lib/oauth/constants";
import { signInAsDebugUser } from "../../../../utils/auth";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db";
import {
  DEFAULT_CLIENT_SCOPE,
  expectMcpCorsHeaders,
  issueAccessToken,
  MCP_CLIENT_SCOPE,
  MCP_CLIENT_SCOPES,
  TRUSTED_BROWSER_ORIGIN,
} from "./helpers";

test.describe("/api/mcp - transport and authorization", () => {
  test.describe.configure({ mode: "serial" });

  test("/api/mcp 未认证时返回 OAuth bearer challenge", async ({ request }) => {
    const response = await request.post("/api/mcp", {
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: {
            name: "unauthenticated-e2e-client",
            version: "1.0.0",
          },
        },
      },
      headers: {
        "MCP-Protocol-Version": "2025-03-26",
      },
    });

    expect(response.status()).toBe(401);
    expect(response.headers()["www-authenticate"]).toContain(
      "resource_metadata=",
    );
    await expect(response.json()).resolves.toEqual({ error: "invalid_token" });
  });

  test("/api/mcp 支持受信任浏览器来源的预检和 transport CORS headers", async ({
    page,
    request,
  }) => {
    const origin = TRUSTED_BROWSER_ORIGIN;
    const initializePayload = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: {
          name: "browser-cors-e2e-client",
          version: "1.0.0",
        },
      },
    };

    const preflight = await request.fetch("/api/mcp", {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers":
          "authorization,content-type,mcp-protocol-version,mcp-session-id,last-event-id",
      },
    });
    expect(preflight.status()).toBe(204);
    expectMcpCorsHeaders(preflight.headers(), origin);

    const unauthenticatedResponse = await request.post("/api/mcp", {
      data: initializePayload,
      headers: {
        Accept: "application/json, text/event-stream",
        Origin: origin,
        "MCP-Protocol-Version": "2025-03-26",
      },
    });
    expect(unauthenticatedResponse.status()).toBe(401);
    expectMcpCorsHeaders(unauthenticatedResponse.headers(), origin);
    expect(unauthenticatedResponse.headers()["www-authenticate"]).toContain(
      "resource_metadata=",
    );

    const resource = `${PLAYWRIGHT_BASE_URL}/api/mcp`;
    await signInAsDebugUser(page, "/");
    const { accessToken } = await issueAccessToken(page, request, {
      scope: MCP_CLIENT_SCOPE,
      clientScopes: MCP_CLIENT_SCOPES,
      resource,
    });

    const authenticatedResponse = await request.post("/api/mcp", {
      data: initializePayload,
      headers: {
        Accept: "application/json, text/event-stream",
        Origin: origin,
        Authorization: `Bearer ${accessToken}`,
        "MCP-Protocol-Version": "2025-03-26",
      },
    });
    expect(authenticatedResponse.status()).toBe(200);
    expectMcpCorsHeaders(authenticatedResponse.headers(), origin);
  });

  test("/api/mcp 拒绝外部 Origin header", async ({ page, request }) => {
    const origin = "https://evil.example";
    const resource = `${PLAYWRIGHT_BASE_URL}/api/mcp`;
    const initializePayload = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: {
          name: "foreign-origin-e2e-client",
          version: "1.0.0",
        },
      },
    };

    await signInAsDebugUser(page, "/");
    const { accessToken } = await issueAccessToken(page, request, {
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
    expect(preflight.headers()["access-control-allow-origin"]).toBeUndefined();
    await expect(preflight.json()).resolves.toEqual({
      error: "invalid_origin",
    });

    const response = await request.post("/api/mcp", {
      data: initializePayload,
      headers: {
        Accept: "application/json, text/event-stream",
        Origin: origin,
        Authorization: `Bearer ${accessToken}`,
        "MCP-Protocol-Version": "2025-03-26",
      },
    });
    expect(response.status()).toBe(403);
    expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
    await expect(response.json()).resolves.toEqual({ error: "invalid_origin" });
  });

  test("/api/mcp 缺少 mcp:tools scope 时返回 insufficient_scope", async ({
    page,
    request,
  }) => {
    const resource = `${PLAYWRIGHT_BASE_URL}/api/mcp`;
    await signInAsDebugUser(page, "/");

    const { accessToken } = await issueAccessToken(page, request, {
      scope: DEFAULT_CLIENT_SCOPE,
      clientScopes: [...DEFAULT_OAUTH_CLIENT_SCOPES],
      resource,
    });

    const response = await request.post("/api/mcp", {
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: {
            name: "insufficient-scope-e2e-client",
            version: "1.0.0",
          },
        },
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "MCP-Protocol-Version": "2025-03-26",
      },
    });

    expect(response.status()).toBe(403);
    expect(response.headers()["www-authenticate"]).toContain(
      'error="insufficient_scope"',
    );
    expect(response.headers()["www-authenticate"]).toContain(
      `scope="${MCP_TOOLS_SCOPE}"`,
    );
    await expect(response.json()).resolves.toEqual({
      error: "insufficient_scope",
    });
  });
});
