import { expect, test } from "@playwright/test";
import {
  DEFAULT_OAUTH_CLIENT_SCOPES,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
  OAUTH_REST_READ_SCOPE,
} from "@/lib/oauth/constants";
import { signInAsDebugUser } from "../../../../utils/auth";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db";
import {
  expectAccessTokenCannotInitializeMcp,
  issueAccessToken,
  MCP_CLIENT_SCOPE,
  MCP_CLIENT_SCOPES,
} from "./helpers";

test.describe("/api/mcp - OAuth token resource binding", () => {
  test.describe.configure({ mode: "serial" });

  test("opaque access token (no resource on token exchange) is rejected by /api/mcp", async ({
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

    expect(accessToken.split(".").length).toBeLessThan(3);

    const response = await request.post("/api/mcp", {
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: {
            name: "opaque-token-e2e-client",
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

    expect(response.status()).toBe(401);
    expect(response.headers()["www-authenticate"]).toContain(
      'error="invalid_token"',
    );
    expect(response.headers()["www-authenticate"]).toContain(
      "resource_metadata=",
    );
    await expect(response.json()).resolves.toEqual({ error: "invalid_token" });
  });

  test("opaque MCP access token is rejected by protected REST routes", async ({
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

    expect(accessToken.split(".").length).toBeLessThan(3);

    const response = await request.get("/api/todos", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(401);
  });

  test("MCP refresh token without resource refreshes to a usable MCP access token", async ({
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

  test("resource-less MCP refresh token cannot omit resource to mint an MCP access token", async ({
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

  test("REST-only refresh token cannot omit resource to mint an MCP access token", async ({
    page,
    request,
  }) => {
    const restResource = `${PLAYWRIGHT_BASE_URL}/api/auth`;
    const restClientScopes = [
      ...DEFAULT_OAUTH_CLIENT_SCOPES,
      OAUTH_OFFLINE_ACCESS_SCOPE,
      OAUTH_REST_READ_SCOPE,
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
