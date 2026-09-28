import { expect, type Page } from "@playwright/test";
import {
  DEFAULT_OAUTH_CLIENT_SCOPES,
  OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
  OAUTH_CODE_RESPONSE_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { PUBLIC_REST_SCOPES } from "@/lib/oauth/scope-registry";
import { sha256Base64Url } from "../../../../../shared/crypto";
import type { IsolatedWorker } from "../../../../utils/isolated-worker";

async function generateCodeChallenge(codeVerifier: string) {
  return sha256Base64Url(codeVerifier);
}

/** The private Worker owns anonymous DCR clients, unexchanged codes and queues,
 * including failures before any HTTP response can be decoded. */
export type OAuthOwner = {
  worker: IsolatedWorker;
  clientNames: string[];
};
export const MCP_CLIENT_SCOPES = [
  ...DEFAULT_OAUTH_CLIENT_SCOPES,
  ...PUBLIC_REST_SCOPES,
];
export const MCP_CLIENT_SCOPE = MCP_CLIENT_SCOPES.join(" ");
export const DEFAULT_CLIENT_SCOPE = DEFAULT_OAUTH_CLIENT_SCOPES.join(" ");

export async function registerPublicClient(
  request: Page["request"],
  scope: string,
  owner: OAuthOwner,
) {
  const clientName = `mcp-e2e-${crypto.randomUUID()}`;
  owner.clientNames.push(clientName);
  const response = await request.post("/api/auth/oauth2/register", {
    data: {
      application_type: "native",
      client_name: clientName,
      redirect_uris: [`${owner.worker.origin}/e2e/oauth/callback`],
      token_endpoint_auth_method: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
      grant_types: [OAUTH_AUTHORIZATION_CODE_GRANT_TYPE],
      response_types: [OAUTH_CODE_RESPONSE_TYPE],
      scope,
    },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { client_id?: string };
  expect(typeof body.client_id).toBe("string");
  return body.client_id as string;
}

async function authorizeAndGetCode(
  page: Page,
  clientId: string,
  options: {
    scope: string;
    codeChallenge?: string;
    owner: OAuthOwner;
    resource?: string;
  },
) {
  const state = crypto.randomUUID();
  const authorizeResponse = await page.request.get(
    "/api/auth/oauth2/authorize",
    {
      params: {
        response_type: OAUTH_CODE_RESPONSE_TYPE,
        client_id: clientId,
        redirect_uri: `${options.owner.worker.origin}/e2e/oauth/callback`,
        scope: options.scope,
        state,
        prompt: "consent",
        ...(options.codeChallenge
          ? {
              code_challenge: options.codeChallenge,
              code_challenge_method: "S256",
            }
          : {}),
        ...(options.resource ? { resource: options.resource } : {}),
      },
      maxRedirects: 0,
    },
  );

  expect(authorizeResponse.status()).toBe(302);
  const consentLocation = authorizeResponse.headers().location;
  expect(typeof consentLocation).toBe("string");
  expect(consentLocation).toContain("/oauth/authorize?");

  await page.goto(consentLocation);
  await expect(page.getByText(/回调主机|Redirect host/i)).toBeVisible();
  await expect(
    page.getByText(/本地应用|application on your device/i),
  ).toBeVisible();
  await page.getByRole("button", { name: /允许|Allow/i }).click();
  await page.waitForURL("**/e2e/oauth/callback**");

  const callbackUrl = new URL(page.url());
  expect(callbackUrl.searchParams.get("state")).toBe(state);
  const code = callbackUrl.searchParams.get("code");
  expect(typeof code).toBe("string");
  return code as string;
}

export async function issueAccessTokenForClient(
  page: Page,
  request: Page["request"],
  options: {
    clientId: string;
    scope: string;
    owner: OAuthOwner;
    resource?: string;
    /** Whether to repeat the authorization request's `resource` at token exchange. */
    includeResourceInTokenExchange?: boolean;
  },
) {
  const codeVerifier = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const code = await authorizeAndGetCode(page, options.clientId, {
    scope: options.scope,
    owner: options.owner,
    codeChallenge,
    resource: options.resource,
  });

  const includeResourceInToken =
    options.includeResourceInTokenExchange !== false && options.resource;
  const tokenResponse = await request.post("/api/auth/oauth2/token", {
    form: {
      grant_type: OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
      client_id: options.clientId,
      code,
      code_verifier: codeVerifier,
      redirect_uri: `${options.owner.worker.origin}/e2e/oauth/callback`,
      ...(includeResourceInToken ? { resource: options.resource } : {}),
    },
  });

  const tokenBody = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
  };
  return { response: tokenResponse, tokenBody };
}

export async function issueAccessToken(
  page: Page,
  request: Page["request"],
  options: {
    scope: string;
    clientScopes: string[];
    owner: OAuthOwner;
    resource?: string;
    /** Whether to repeat the authorization request's `resource` at token exchange. */
    includeResourceInTokenExchange?: boolean;
  },
) {
  const clientId = await registerPublicClient(
    request,
    options.clientScopes.join(" "),
    options.owner,
  );

  const { response: tokenResponse, tokenBody } =
    await issueAccessTokenForClient(page, request, {
      clientId,
      owner: options.owner,
      scope: options.scope,
      resource: options.resource,
      includeResourceInTokenExchange: options.includeResourceInTokenExchange,
    });

  expect(tokenResponse.status()).toBe(200);
  expect(typeof tokenBody.access_token).toBe("string");

  return {
    clientId,
    accessToken: tokenBody.access_token as string,
    refreshToken: tokenBody.refresh_token,
  };
}

export function getTextContent(result: unknown) {
  const content =
    typeof result === "object" &&
    result !== null &&
    "content" in result &&
    Array.isArray(result.content)
      ? result.content
      : [];
  const textContent = content.find(
    (item): item is { type: "text"; text: string } =>
      typeof item === "object" &&
      item !== null &&
      "type" in item &&
      "text" in item &&
      item.type === "text" &&
      typeof item.text === "string",
  );
  expect(textContent).toBeDefined();
  return textContent?.text ?? "{}";
}

export function parseTextContent(result: unknown) {
  const text = getTextContent(result);
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch (cause) {
    throw new Error(`MCP text content is not JSON: ${text.slice(0, 500)}`, {
      cause,
    });
  }
}

export function expectMcpCorsHeaders(
  headers: Record<string, string>,
  expectedOrigin = "*",
) {
  const allowHeaders =
    headers["access-control-allow-headers"]?.toLowerCase() ?? "";
  const allowMethods =
    headers["access-control-allow-methods"]?.toLowerCase() ?? "";
  const exposeHeaders =
    headers["access-control-expose-headers"]?.toLowerCase() ?? "";

  expect(headers["access-control-allow-origin"]).toBe(expectedOrigin);
  expect(allowMethods).toContain("post");
  expect(allowMethods).toContain("delete");
  expect(allowMethods).toContain("options");
  expect(allowHeaders).toContain("authorization");
  expect(allowHeaders).toContain("content-type");
  expect(allowHeaders).toContain("mcp-protocol-version");
  expect(allowHeaders).toContain("mcp-session-id");
  expect(allowHeaders).toContain("last-event-id");
  expect(exposeHeaders).toContain("mcp-session-id");
  expect(exposeHeaders).toContain("www-authenticate");
}

export async function expectAccessTokenCannotInitializeMcp(
  request: Page["request"],
  accessToken: string,
  clientName: string,
) {
  const response = await request.post("/api/mcp", {
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: {
          name: clientName,
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

  expect([401, 403]).toContain(response.status());
}
