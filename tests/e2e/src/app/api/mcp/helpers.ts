import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, type Page } from "@playwright/test";
import {
  DEFAULT_OAUTH_CLIENT_SCOPES,
  OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
  OAUTH_CODE_RESPONSE_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
  PUBLIC_REST_FEATURES,
  restReadScope,
  restWriteScope,
} from "@/lib/oauth/constants";
import { sha256Base64Url } from "../../../../../shared/crypto";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import {
  getCurrentSessionUser,
  PLAYWRIGHT_BASE_URL,
} from "../../../../utils/e2e-db";

async function generateCodeChallenge(codeVerifier: string) {
  return sha256Base64Url(codeVerifier);
}

const REDIRECT_URI = `${PLAYWRIGHT_BASE_URL}/e2e/oauth/callback`;
export const MCP_CLIENT_SCOPES = [
  ...DEFAULT_OAUTH_CLIENT_SCOPES,
  ...PUBLIC_REST_FEATURES.flatMap((feature) => [
    restReadScope(feature),
    restWriteScope(feature),
  ]),
];
export const MCP_CLIENT_SCOPE = MCP_CLIENT_SCOPES.join(" ");
export const DEFAULT_CLIENT_SCOPE = DEFAULT_OAUTH_CLIENT_SCOPES.join(" ");
export const TRUSTED_BROWSER_ORIGIN = PLAYWRIGHT_BASE_URL.includes("127.0.0.1")
  ? PLAYWRIGHT_BASE_URL.replace("127.0.0.1", "localhost")
  : PLAYWRIGHT_BASE_URL.replace("localhost", "127.0.0.1");

async function resumeConsentIfSignInPage(page: Page) {
  const allowButton = page.getByRole("button", { name: /允许|Allow/i });
  const debugSignInButton = page
    .getByRole("button", {
      name: /Sign in with Debug User \(Dev\)|调试用户（开发）/i,
    })
    .first();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const visibleTarget = await Promise.race([
      allowButton
        .waitFor({ state: "visible", timeout: attempt === 0 ? 5_000 : 1_500 })
        .then(() => "allow" as const)
        .catch(() => null),
      debugSignInButton
        .waitFor({ state: "visible", timeout: attempt === 0 ? 5_000 : 1_500 })
        .then(() => "signin" as const)
        .catch(() => null),
    ]);

    if (visibleTarget === "allow") {
      return;
    }
    if (visibleTarget === "signin") {
      await debugSignInButton.click();
      await page.waitForURL(/\/oauth\/authorize\?/);
    }
  }

  await allowButton.waitFor({ state: "visible" });
}

async function registerPublicClient(request: Page["request"], scope: string) {
  const response = await request.post("/api/auth/oauth2/register", {
    data: {
      client_name: `mcp-e2e-${Date.now()}`,
      redirect_uris: [REDIRECT_URI],
      token_endpoint_auth_method: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
      grant_types: [OAUTH_AUTHORIZATION_CODE_GRANT_TYPE],
      response_types: [OAUTH_CODE_RESPONSE_TYPE],
      scope,
    },
  });
  expect(response.status()).toBe(200);
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
    resource?: string;
  },
) {
  const authorizeResponse = await page.request.get(
    "/api/auth/oauth2/authorize",
    {
      params: {
        response_type: OAUTH_CODE_RESPONSE_TYPE,
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        scope: options.scope,
        state: `mcp-e2e-state-${Date.now()}`,
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
  await resumeConsentIfSignInPage(page);
  await page.getByRole("button", { name: /允许|Allow/i }).click();
  await page.waitForURL("**/e2e/oauth/callback**");

  const callbackUrl = new URL(page.url());
  const code = callbackUrl.searchParams.get("code");
  expect(typeof code).toBe("string");
  return code as string;
}

export async function issueAccessToken(
  page: Page,
  request: Page["request"],
  options: {
    scope: string;
    clientScopes: string[];
    resource?: string;
    /** Omit `resource` on token exchange → opaque access token (ChatGPT-style). */
    includeResourceInTokenExchange?: boolean;
  },
) {
  const clientId = await registerPublicClient(
    request,
    options.clientScopes.join(" "),
  );

  const codeVerifier =
    "mcp-public-client-verifier-012345678901234567890123456789";
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const code = await authorizeAndGetCode(page, clientId, {
    scope: options.scope,
    codeChallenge,
    resource: options.resource,
  });

  const includeResourceInToken =
    options.includeResourceInTokenExchange !== false && options.resource;

  const tokenResponse = await request.post("/api/auth/oauth2/token", {
    form: {
      grant_type: OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      redirect_uri: REDIRECT_URI,
      ...(includeResourceInToken ? { resource: options.resource } : {}),
    },
  });

  expect(tokenResponse.status()).toBe(200);
  const tokenBody = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
  };
  expect(typeof tokenBody.access_token).toBe("string");

  return {
    clientId,
    accessToken: tokenBody.access_token as string,
    refreshToken: tokenBody.refresh_token,
  };
}

export async function createAuthenticatedMcpClient(
  page: Page,
  request: Page["request"],
) {
  const resource = `${PLAYWRIGHT_BASE_URL}/api/mcp`;
  await signInAsDebugUser(page, "/");
  const currentUser = await getCurrentSessionUser(page);
  const { accessToken } = await issueAccessToken(page, request, {
    scope: MCP_CLIENT_SCOPE,
    clientScopes: MCP_CLIENT_SCOPES,
    resource,
  });

  const transport = new StreamableHTTPClientTransport(new URL(resource), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
  const client = new Client({
    name: "life-ustc-e2e-client",
    version: "1.0.0",
  });
  try {
    await client.connect(transport);
  } catch (error) {
    await transport.close();
    throw error;
  }

  return {
    client,
    currentUser,
    resource,
    transport,
    close: () => transport.close(),
  };
}

export async function getCurrentSubscriptionSectionIds(
  request: Page["request"],
) {
  const response = await request.get("/api/calendar-subscriptions/current");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    subscription?: { sections?: Array<{ id?: number }> } | null;
  };
  return (
    body.subscription?.sections
      ?.map((section) => section.id)
      .filter((id): id is number => typeof id === "number") ?? []
  );
}

export async function getSeedSectionId(request: Page["request"]) {
  const response = await request.post("/api/sections/match-codes", {
    data: { codes: [DEV_SEED.section.code] },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    sections?: Array<{ id?: number; code?: string | null }>;
  };
  const seedSection = body.sections?.find(
    (section) => section.code === DEV_SEED.section.code,
  );
  expect(seedSection?.id).toBeDefined();
  if (seedSection?.id == null) {
    throw new Error("Expected seed section id");
  }
  return seedSection.id;
}

export async function replaceCalendarSubscription(
  request: Page["request"],
  sectionIds: number[],
) {
  const response = await request.post("/api/calendar-subscriptions", {
    data: { sectionIds },
  });
  expect(response.status()).toBe(200);
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
  return JSON.parse(getTextContent(result)) as Record<string, unknown>;
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
  expect(allowMethods).toContain("get");
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

export type BusPreference = {
  preferredDestinationCampusId?: number | null;
  preferredOriginCampusId?: number | null;
  showDepartedTrips?: boolean;
};

export async function saveBusPreference(
  request: Page["request"],
  preference: BusPreference,
) {
  const response = await request.post("/api/bus/preferences", {
    data: {
      preferredOriginCampusId: preference.preferredOriginCampusId ?? null,
      preferredDestinationCampusId:
        preference.preferredDestinationCampusId ?? null,
      showDepartedTrips: preference.showDepartedTrips ?? false,
    },
  });
  expect(response.status()).toBe(200);
}
