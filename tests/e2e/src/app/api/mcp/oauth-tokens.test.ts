import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, test } from "@playwright/test";
import { decodeJwt } from "jose";
import {
  DEFAULT_OAUTH_CLIENT_SCOPES,
  OAUTH_GRANT_ID_CLAIM,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
  restReadScope,
} from "@/lib/oauth/constants";
import { signInAsDebugUser } from "../../../../utils/auth";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db";
import {
  expectAccessTokenCannotInitializeMcp,
  issueAccessToken,
  issueAccessTokenForClient,
  MCP_CLIENT_SCOPE,
  MCP_CLIENT_SCOPES,
  registerPublicClient,
} from "./helpers";

test.describe("/api/mcp - OAuth token 资源绑定", () => {
  test.describe.configure({ mode: "serial" });

  test("授权码已绑定 resource 时 token exchange 可省略 resource", async ({
    page,
    request,
  }) => {
    const resource = `${PLAYWRIGHT_BASE_URL}/api/mcp`;
    await signInAsDebugUser(page, "/");

    const { accessToken } = await issueAccessToken(page, request, {
      scope: MCP_CLIENT_SCOPE,
      clientScopes: MCP_CLIENT_SCOPES,
      resource,
      includeResourceInTokenExchange: false,
    });

    expect(accessToken.split(".").length).toBe(3);

    const response = await request.post("/api/mcp", {
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: {
            name: "code-bound-resource-e2e-client",
            version: "1.0.0",
          },
        },
      },
      headers: {
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${accessToken}`,
        "MCP-Protocol-Version": "2025-03-26",
      },
    });

    expect(response.status()).toBe(200);
  });

  test("同一客户端增权后签发精确绑定且包含累计 scope 的 MCP token", async ({
    page,
    request,
  }) => {
    const resource = `${PLAYWRIGHT_BASE_URL}/api/mcp`;
    const baselineScopes = [
      restReadScope("account.profile"),
      OAUTH_OFFLINE_ACCESS_SCOPE,
    ];
    const expandedScopes = [...baselineScopes, restReadScope("workspace.todo")];
    await signInAsDebugUser(page, "/");
    const clientId = await registerPublicClient(
      request,
      expandedScopes.join(" "),
    );

    const baseline = await issueAccessTokenForClient(page, request, {
      clientId,
      resource,
      scope: baselineScopes.join(" "),
    });
    expect(baseline.response.status()).toBe(200);

    const expanded = await issueAccessTokenForClient(page, request, {
      clientId,
      resource,
      scope: expandedScopes.join(" "),
    });
    expect(expanded.response.status()).toBe(200);
    expect(typeof expanded.tokenBody.access_token).toBe("string");
    const accessToken = expanded.tokenBody.access_token as string;
    const claims = decodeJwt(accessToken);
    expect(claims[OAUTH_GRANT_ID_CLAIM]).toEqual(expect.any(String));
    expect(new Set(String(claims.scope).split(" "))).toEqual(
      new Set(expandedScopes),
    );

    const transport = new StreamableHTTPClientTransport(new URL(resource), {
      requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const client = new Client({
      name: "incremental-scope-e2e-client",
      version: "1.0.0",
    });
    await client.connect(transport);
    try {
      await expect(
        client.callTool({ name: "workspace_todo_list", arguments: {} }),
      ).resolves.toMatchObject({ structuredContent: { success: true } });
    } finally {
      await transport.close();
    }
  });

  test("MCP resource JWT 被受保护 REST 路由拒绝", async ({ page, request }) => {
    const resource = `${PLAYWRIGHT_BASE_URL}/api/mcp`;
    await signInAsDebugUser(page, "/");

    const { accessToken } = await issueAccessToken(page, request, {
      scope: MCP_CLIENT_SCOPE,
      clientScopes: MCP_CLIENT_SCOPES,
      resource,
      includeResourceInTokenExchange: false,
    });

    expect(accessToken.split(".").length).toBe(3);

    const response = await request.get("/api/workspace/todos", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(401);
  });

  test("无 resource 的 MCP refresh token 可刷新为可用的 MCP access token", async ({
    page,
    request,
  }) => {
    const resource = `${PLAYWRIGHT_BASE_URL}/api/mcp`;
    await signInAsDebugUser(page, "/");

    const { clientId, refreshToken } = await issueAccessToken(page, request, {
      scope: `${MCP_CLIENT_SCOPE} ${OAUTH_OFFLINE_ACCESS_SCOPE}`,
      clientScopes: [...MCP_CLIENT_SCOPES, OAUTH_OFFLINE_ACCESS_SCOPE],
      resource,
    });
    expect(typeof refreshToken).toBe("string");
    if (typeof refreshToken !== "string") {
      throw new Error("Expected refresh token");
    }

    const refreshResponse = await request.post("/api/auth/oauth2/token", {
      form: {
        grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
        client_id: clientId,
        refresh_token: refreshToken,
      },
    });
    expect(refreshResponse.status()).toBe(200);
    const refreshBody = (await refreshResponse.json()) as {
      access_token?: string;
    };
    expect(typeof refreshBody.access_token).toBe("string");
    expect(refreshBody.access_token?.split(".").length).toBe(3);

    const response = await request.post("/api/mcp", {
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: {
            name: "refreshed-token-e2e-client",
            version: "1.0.0",
          },
        },
      },
      headers: {
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${refreshBody.access_token}`,
        "MCP-Protocol-Version": "2025-03-26",
      },
    });

    expect(response.status()).toBe(200);
  });

  test("无 resource 的 MCP refresh token 不能省略 resource 来签发 MCP access token", async ({
    page,
    request,
  }) => {
    await signInAsDebugUser(page, "/");

    const { clientId, refreshToken } = await issueAccessToken(page, request, {
      scope: `${MCP_CLIENT_SCOPE} ${OAUTH_OFFLINE_ACCESS_SCOPE}`,
      clientScopes: [...MCP_CLIENT_SCOPES, OAUTH_OFFLINE_ACCESS_SCOPE],
    });
    expect(typeof refreshToken).toBe("string");
    if (typeof refreshToken !== "string") {
      throw new Error("Expected refresh token");
    }

    const refreshResponse = await request.post("/api/auth/oauth2/token", {
      form: {
        grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
        client_id: clientId,
        refresh_token: refreshToken,
      },
    });
    expect(refreshResponse.status()).toBe(200);
    const refreshBody = (await refreshResponse.json()) as {
      access_token?: string;
    };
    expect(typeof refreshBody.access_token).toBe("string");

    await expectAccessTokenCannotInitializeMcp(
      request,
      refreshBody.access_token as string,
      "resource-less-refresh-e2e-client",
    );
  });

  test("仅 REST 的 refresh token 不能省略 resource 来签发 MCP access token", async ({
    page,
    request,
  }) => {
    const restResource = `${PLAYWRIGHT_BASE_URL}/api/auth`;
    const restClientScopes = [
      ...DEFAULT_OAUTH_CLIENT_SCOPES,
      OAUTH_OFFLINE_ACCESS_SCOPE,
      restReadScope("workspace.todo"),
    ];
    await signInAsDebugUser(page, "/");

    const { clientId, refreshToken } = await issueAccessToken(page, request, {
      scope: restClientScopes.join(" "),
      clientScopes: restClientScopes,
      resource: restResource,
    });
    expect(typeof refreshToken).toBe("string");
    if (typeof refreshToken !== "string") {
      throw new Error("Expected refresh token");
    }

    const refreshResponse = await request.post("/api/auth/oauth2/token", {
      form: {
        grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
        client_id: clientId,
        refresh_token: refreshToken,
      },
    });
    expect(refreshResponse.status()).toBe(200);
    const refreshBody = (await refreshResponse.json()) as {
      access_token?: string;
    };
    expect(typeof refreshBody.access_token).toBe("string");

    await expectAccessTokenCannotInitializeMcp(
      request,
      refreshBody.access_token as string,
      "rest-only-refresh-e2e-client",
    );
  });
});
