/**
 * E2E tests for `POST /api/mcp` — Model Context Protocol Streamable-HTTP transport.
 *
 * Route behaviour (src/routes/api/mcp/+server.ts):
 *   - Requires an OAuth 2.0 Bearer token with the `mcp:tools` scope.
 *   - Returns a 401 with `WWW-Authenticate: Bearer` when no token is present.
 *   - Returns a 403 `insufficient_scope` when the token lacks `mcp:tools`.
 *   - Supports trusted browser-origin CORS preflight and transport headers.
 *   - Rejects foreign Origin headers before auth/tool handling.
 *   - Once authenticated, exposes 20+ tools via MCP protocol (homeworks, todos, buses, etc.).
 *
 * Tests exercise:
 *   1. Unauthenticated request → 401 Bearer challenge.
 *   2. Trusted browser-origin preflight + transport headers.
 *   3. Foreign Origin header → rejected.
 *   4. Token without `mcp:tools` scope → 403 insufficient_scope.
 *   5. Opaque access-token (no resource indicator) → rejected by MCP resource binding.
 *   6. Full PKCE flow with resource indicator → MCP session + calls every seeded tool.
 */
import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, type Page, test } from "@playwright/test";
import {
  DEFAULT_OAUTH_CLIENT_SCOPES,
  MCP_TOOLS_SCOPE,
  OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
  OAUTH_CODE_RESPONSE_TYPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
} from "@/lib/oauth/constants";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED, DEV_SEED_ANCHOR } from "../../../../utils/dev-seed";
import {
  getCurrentSessionUser,
  PLAYWRIGHT_BASE_URL,
} from "../../../../utils/e2e-db";

function generateCodeChallenge(codeVerifier: string) {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

const REDIRECT_URI = `${PLAYWRIGHT_BASE_URL}/e2e/oauth/callback`;
const MCP_CLIENT_SCOPES = [...DEFAULT_OAUTH_CLIENT_SCOPES, MCP_TOOLS_SCOPE];
const MCP_CLIENT_SCOPE = MCP_CLIENT_SCOPES.join(" ");
const DEFAULT_CLIENT_SCOPE = DEFAULT_OAUTH_CLIENT_SCOPES.join(" ");
const TRUSTED_BROWSER_ORIGIN = PLAYWRIGHT_BASE_URL.includes("127.0.0.1")
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

async function issueAccessToken(
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
  const codeChallenge = generateCodeChallenge(codeVerifier);

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

function getTextContent(result: unknown) {
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

function parseTextContent(result: unknown) {
  return JSON.parse(getTextContent(result)) as Record<string, unknown>;
}

function expectMcpCorsHeaders(
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

async function resetBusPreference(request: Page["request"]) {
  await request.post("/api/bus/preferences", {
    data: {
      preferredOriginCampusId: null,
      preferredDestinationCampusId: null,
      showDepartedTrips: false,
    },
  });
}

test.describe("/api/mcp – MCP Streamable-HTTP transport", () => {
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

  test("OAuth PKCE token can connect to /api/mcp and call all seeded tools", async ({
    page,
    request,
  }) => {
    const resource = `${PLAYWRIGHT_BASE_URL}/api/mcp`;
    await signInAsDebugUser(page, "/");
    const currentUser = await getCurrentSessionUser(page);
    await page.request.post("/api/bus/preferences", {
      data: {
        preferredOriginCampusId: 1,
        preferredDestinationCampusId: 4,
        showDepartedTrips: true,
      },
    });
    const { accessToken } = await issueAccessToken(page, request, {
      scope: MCP_CLIENT_SCOPE,
      clientScopes: MCP_CLIENT_SCOPES,
      resource,
    });

    const metadataResponse = await request.get(
      "/.well-known/oauth-authorization-server",
    );
    expect(metadataResponse.status()).toBe(200);

    const currentSubscriptionRes = await page.request.get(
      "/api/calendar-subscriptions/current",
    );
    const currentSubscriptionBody = (await currentSubscriptionRes.json()) as {
      subscription?: { sections?: Array<{ id?: number }> } | null;
    };
    const originalSectionIds =
      currentSubscriptionBody.subscription?.sections?.map(
        (section) => section.id as number,
      ) ?? [];

    const matchSectionsRes = await page.request.post(
      "/api/sections/match-codes",
      {
        data: { codes: [DEV_SEED.section.code] },
      },
    );
    expect(matchSectionsRes.status()).toBe(200);
    const matchSectionsBody = (await matchSectionsRes.json()) as {
      sections?: Array<{ id?: number; code?: string | null }>;
    };
    const seedSection = matchSectionsBody.sections?.find(
      (section) => section.code === DEV_SEED.section.code,
    );
    expect(seedSection?.id).toBeDefined();
    if (seedSection?.id == null) {
      throw new Error("Expected seed section id");
    }

    const transport = new StreamableHTTPClientTransport(new URL(resource), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
    const mcpClient = new Client({
      name: "life-ustc-e2e-client",
      version: "1.0.0",
    });

    try {
      await page.request.post("/api/calendar-subscriptions", {
        data: { sectionIds: [seedSection.id] },
      });

      await mcpClient.connect(transport);

      const tools = await mcpClient.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining([
          "get_my_profile",
          "list_my_todos",
          "create_my_todo",
          "update_my_todo",
          "delete_my_todo",
          "get_my_dashboard",
          "get_next_class",
          "get_upcoming_deadlines",
          "list_my_homeworks",
          "set_my_homework_completion",
          "list_my_schedules",
          "list_my_exams",
          "get_my_overview",
          "get_my_7days_timeline",
          "search_courses",
          "match_section_codes",
          "get_my_calendar_subscription",
          "subscribe_my_sections_by_codes",
          "get_section_by_jw_id",
          "list_homeworks_by_section",
          "list_schedules_by_section",
          "list_exams_by_section",
          "query_bus_timetable",
          "list_bus_routes",
          "get_bus_route_timetable",
          "search_bus_routes",
          "get_next_buses",
        ]),
      );
      expect(tools.tools.map((tool) => tool.name)).not.toEqual(
        expect.arrayContaining([
          "list_comments",
          "create_comment",
          "set_comment_reaction",
        ]),
      );

      const profileResult = await mcpClient.callTool({
        name: "get_my_profile",
        arguments: {},
      });
      const profile = parseTextContent(profileResult) as {
        id?: string;
        username?: string | null;
        createdAt?: string;
      };
      expect(profile.id).toBe(currentUser.id);
      expect(profile.username).toBe(currentUser.username ?? null);
      expect(typeof profile.createdAt).toBe("string");
      expect(profile.createdAt).toMatch(/\+08:00$/);

      const todosResult = await mcpClient.callTool({
        name: "list_my_todos",
        arguments: {},
      });
      const todosPayload = parseTextContent(todosResult) as {
        counts?: {
          incomplete?: number;
          completed?: number;
          overdue?: number;
        };
        todos?: Array<{ title?: string; completed?: boolean }>;
      };
      expect(typeof todosPayload.counts?.incomplete).toBe("number");
      expect(typeof todosPayload.counts?.completed).toBe("number");
      expect(
        todosPayload.todos?.some(
          (todo) =>
            todo.title === DEV_SEED.todos.dueTodayTitle &&
            todo.completed === false,
        ),
      ).toBe(true);
      expect(
        todosPayload.todos?.some(
          (todo) =>
            todo.title === DEV_SEED.todos.completedTitle &&
            todo.completed === true,
        ),
      ).toBe(false);

      const coursesResult = await mcpClient.callTool({
        name: "search_courses",
        arguments: {
          search: DEV_SEED.course.code,
          limit: 5,
          locale: "zh-cn",
        },
      });
      const coursesPayload = parseTextContent(coursesResult) as {
        courses?: Array<{
          jwId?: number;
          code?: string | null;
          namePrimary?: string | null;
        }>;
      };
      expect(
        coursesPayload.courses?.some(
          (course) =>
            course.jwId === DEV_SEED.course.jwId &&
            course.code === DEV_SEED.course.code &&
            course.namePrimary === DEV_SEED.course.nameCn,
        ),
      ).toBe(true);

      const sectionResult = await mcpClient.callTool({
        name: "get_section_by_jw_id",
        arguments: {
          jwId: DEV_SEED.section.jwId,
          locale: "zh-cn",
        },
      });
      const sectionPayload = parseTextContent(sectionResult) as {
        found?: boolean;
        section?: {
          id?: number;
          jwId?: number;
          code?: string | null;
          course?: { code?: string | null; namePrimary?: string | null };
        };
      };
      expect(sectionPayload.found).toBe(true);
      expect(sectionPayload.section?.jwId).toBe(DEV_SEED.section.jwId);
      expect(sectionPayload.section?.code).toBe(DEV_SEED.section.code);
      expect(sectionPayload.section?.course?.code).toBe(DEV_SEED.course.code);
      expect(sectionPayload.section?.course?.namePrimary).toBe(
        DEV_SEED.course.nameCn,
      );

      const filteredSectionsResult = await mcpClient.callTool({
        name: "search_sections",
        arguments: {
          courseJwId: DEV_SEED.course.jwId,
          semesterJwId: DEV_SEED.semesterJwId,
          teacherCode: DEV_SEED.teacher.code,
          jwIds: [DEV_SEED.section.jwId],
          locale: "zh-cn",
        },
      });
      const filteredSectionsPayload = parseTextContent(
        filteredSectionsResult,
      ) as {
        data?: Array<{ jwId?: number; code?: string | null }>;
        pagination?: { total?: number };
      };
      expect(filteredSectionsPayload.pagination?.total).toBe(1);
      expect(filteredSectionsPayload.data?.[0]?.jwId).toBe(
        DEV_SEED.section.jwId,
      );
      expect(filteredSectionsPayload.data?.[0]?.code).toBe(
        DEV_SEED.section.code,
      );

      const homeworksResult = await mcpClient.callTool({
        name: "list_homeworks_by_section",
        arguments: {
          sectionJwId: DEV_SEED.section.jwId,
          includeDeleted: false,
          locale: "zh-cn",
        },
      });
      const homeworksPayload = parseTextContent(homeworksResult) as {
        found?: boolean;
        section?: { jwId?: number };
        homeworks?: Array<{
          title?: string;
          section?: { jwId?: number };
          createdBy?: unknown;
          completion?: { completedAt?: string } | null;
          commentCount?: number;
        }>;
      };
      expect(homeworksPayload.found).toBe(true);
      expect(homeworksPayload.section?.jwId).toBe(DEV_SEED.section.jwId);
      expect(
        homeworksPayload.homeworks?.some(
          (homework) => homework.title === DEV_SEED.homeworks.title,
        ),
      ).toBe(true);
      expect(
        homeworksPayload.homeworks?.every(
          (homework) =>
            !Object.hasOwn(homework, "section") &&
            !Object.hasOwn(homework, "createdBy") &&
            typeof homework.commentCount === "number" &&
            Object.hasOwn(homework, "completion"),
        ),
      ).toBe(true);

      const schedulesResult = await mcpClient.callTool({
        name: "list_schedules_by_section",
        arguments: {
          sectionJwId: DEV_SEED.section.jwId,
          limit: 20,
          locale: "zh-cn",
        },
      });
      const schedulesPayload = parseTextContent(schedulesResult) as {
        found?: boolean;
        section?: { jwId?: number };
        schedules?: Array<{ id?: number; section?: unknown }>;
      };
      expect(schedulesPayload.found).toBe(true);
      expect(schedulesPayload.section?.jwId).toBe(DEV_SEED.section.jwId);
      expect((schedulesPayload.schedules?.length ?? 0) > 0).toBe(true);
      expect(
        schedulesPayload.schedules?.every(
          (schedule) => !Object.hasOwn(schedule, "section"),
        ),
      ).toBe(true);

      const queriedSchedulesResult = await mcpClient.callTool({
        name: "query_schedules",
        arguments: {
          sectionCode: DEV_SEED.section.code,
          teacherCode: DEV_SEED.teacher.code,
          roomJwId: 9910031,
          dateFrom: DEV_SEED_ANCHOR.startOfDayAtTime,
          dateTo: "2026-05-10T23:59:59+08:00",
          locale: "zh-cn",
        },
      });
      const queriedSchedulesPayload = parseTextContent(
        queriedSchedulesResult,
      ) as {
        data?: Array<{
          section?: { jwId?: number; code?: string | null };
          room?: { jwId?: number | null };
          teachers?: Array<{ code?: string | null }>;
        }>;
        pagination?: { total?: number };
      };
      expect((queriedSchedulesPayload.pagination?.total ?? 0) > 0).toBe(true);
      expect(
        queriedSchedulesPayload.data?.every(
          (schedule) =>
            schedule.section?.code === DEV_SEED.section.code &&
            schedule.room?.jwId === 9910031 &&
            schedule.teachers?.some(
              (teacher) => teacher.code === DEV_SEED.teacher.code,
            ) === true,
        ),
      ).toBe(true);

      const examsResult = await mcpClient.callTool({
        name: "list_exams_by_section",
        arguments: {
          sectionJwId: DEV_SEED.section.jwId,
          locale: "zh-cn",
        },
      });
      const examsPayload = parseTextContent(examsResult) as {
        found?: boolean;
        section?: { jwId?: number };
        exams?: Array<{ id?: number }>;
      };
      expect(examsPayload.found).toBe(true);
      expect(examsPayload.section?.jwId).toBe(DEV_SEED.section.jwId);
      expect((examsPayload.exams?.length ?? 0) > 0).toBe(true);

      const myHomeworksResult = await mcpClient.callTool({
        name: "list_my_homeworks",
        arguments: {
          completed: false,
          limit: 30,
          locale: "zh-cn",
        },
      });
      const myHomeworksPayload = parseTextContent(myHomeworksResult) as {
        homeworks?: Array<{
          id?: string;
          title?: string;
          completion?: { completedAt?: string } | null;
          commentCount?: number;
        }>;
      };
      expect(
        myHomeworksPayload.homeworks?.some(
          (homework) => homework.title === DEV_SEED.homeworks.title,
        ),
      ).toBe(true);
      expect(
        myHomeworksPayload.homeworks?.some(
          (homework) =>
            typeof homework.commentCount === "number" &&
            Object.hasOwn(homework, "completion"),
        ),
      ).toBe(true);
      const firstHomeworkId = myHomeworksPayload.homeworks?.[0]?.id;
      expect(typeof firstHomeworkId).toBe("string");

      const setCompletionTrueResult = await mcpClient.callTool({
        name: "set_my_homework_completion",
        arguments: {
          homeworkId: firstHomeworkId,
          completed: true,
        },
      });
      const setCompletionTruePayload = parseTextContent(
        setCompletionTrueResult,
      ) as {
        success?: boolean;
        completion?: { completed?: boolean };
      };
      expect(setCompletionTruePayload.success).toBe(true);
      expect(setCompletionTruePayload.completion?.completed).toBe(true);

      const setCompletionFalseResult = await mcpClient.callTool({
        name: "set_my_homework_completion",
        arguments: {
          homeworkId: firstHomeworkId,
          completed: false,
        },
      });
      const setCompletionFalsePayload = parseTextContent(
        setCompletionFalseResult,
      ) as {
        success?: boolean;
        completion?: { completed?: boolean };
      };
      expect(setCompletionFalsePayload.success).toBe(true);
      expect(setCompletionFalsePayload.completion?.completed).toBe(false);

      const mySchedulesResult = await mcpClient.callTool({
        name: "list_my_schedules",
        arguments: {
          limit: 30,
          locale: "zh-cn",
        },
      });
      const mySchedulesPayload = parseTextContent(mySchedulesResult) as {
        schedules?: Array<{ id?: number }>;
      };
      expect((mySchedulesPayload.schedules?.length ?? 0) > 0).toBe(true);

      const myExamsResult = await mcpClient.callTool({
        name: "list_my_exams",
        arguments: {
          includeDateUnknown: true,
          limit: 30,
          locale: "zh-cn",
        },
      });
      const myExamsPayload = parseTextContent(myExamsResult) as {
        exams?: Array<{ id?: number }>;
      };
      expect((myExamsPayload.exams?.length ?? 0) > 0).toBe(true);

      const overviewResult = await mcpClient.callTool({
        name: "get_my_overview",
        arguments: {
          locale: "zh-cn",
        },
      });
      const overviewPayload = parseTextContent(overviewResult) as {
        overview?: {
          pendingTodosCount?: number;
          pendingHomeworksCount?: number;
          todaySchedulesCount?: number;
          upcomingExamsCount?: number;
        };
      };
      expect(typeof overviewPayload.overview?.pendingTodosCount).toBe("number");
      expect(typeof overviewPayload.overview?.pendingHomeworksCount).toBe(
        "number",
      );
      expect(typeof overviewPayload.overview?.todaySchedulesCount).toBe(
        "number",
      );
      expect(typeof overviewPayload.overview?.upcomingExamsCount).toBe(
        "number",
      );
      const overviewSummaryResult = await mcpClient.callTool({
        name: "get_my_overview",
        arguments: {
          locale: "zh-cn",
          mode: "summary",
        },
      });
      const overviewSummaryPayload = parseTextContent(
        overviewSummaryResult,
      ) as {
        samples?: {
          dueTodos?: { total?: number; items?: Array<{ id?: string }> };
          dueHomeworks?: { total?: number; items?: Array<{ id?: string }> };
          upcomingExams?: { total?: number; items?: Array<{ id?: number }> };
        };
      };
      expect(getTextContent(overviewSummaryResult).length).toBeLessThan(
        getTextContent(overviewResult).length,
      );
      expect(typeof overviewSummaryPayload.samples?.dueTodos?.total).toBe(
        "number",
      );
      expect(
        (overviewSummaryPayload.samples?.dueTodos?.items?.length ?? 0) <= 3,
      ).toBe(true);

      const dashboardResult = await mcpClient.callTool({
        name: "get_my_dashboard",
        arguments: {
          locale: "zh-cn",
        },
      });
      const dashboardPayload = parseTextContent(dashboardResult) as {
        currentSemester?: { code?: string | null };
        subscriptions?: {
          currentSemesterCount?: number;
          currentSemesterSectionsTotal?: number;
          currentSemesterSections?: Array<{ jwId?: number }>;
        };
        nextClass?: {
          payload?: { scheduleGroup?: unknown; roomType?: unknown };
        };
        upcomingDeadlines?: {
          total?: number;
          items?: Array<{ type?: string }>;
        };
        todos?: { incompleteCount?: number; items?: Array<{ id?: string }> };
        bus?: {
          nextDeparture?: { routeId?: number | null } | null;
          departures?: Array<{ routeId?: number | null }>;
        };
      };
      expect(dashboardPayload.currentSemester?.code).toBeDefined();
      expect(typeof dashboardPayload.subscriptions?.currentSemesterCount).toBe(
        "number",
      );
      expect(
        dashboardPayload.subscriptions?.currentSemesterSectionsTotal,
      ).toBeGreaterThan(0);
      if (dashboardPayload.nextClass?.payload) {
        expect(dashboardPayload.nextClass.payload).not.toHaveProperty(
          "scheduleGroup",
        );
        expect(dashboardPayload.nextClass.payload).not.toHaveProperty(
          "roomType",
        );
      }
      expect(typeof dashboardPayload.todos?.incompleteCount).toBe("number");
      expect(typeof dashboardPayload.upcomingDeadlines?.total).toBe("number");
      const nextDeparture = dashboardPayload.bus?.nextDeparture ?? null;
      if (nextDeparture) {
        expect(typeof nextDeparture.routeId).toBe("number");
      } else {
        expect(nextDeparture).toBeNull();
      }
      const dashboardSummaryResult = await mcpClient.callTool({
        name: "get_my_dashboard",
        arguments: {
          locale: "zh-cn",
          mode: "summary",
        },
      });
      const dashboardSummaryPayload = parseTextContent(
        dashboardSummaryResult,
      ) as {
        subscriptions?: {
          currentSemesterSections?: unknown;
          currentSemesterSectionsTotal?: number;
        };
        upcomingDeadlines?: {
          total?: number;
          items?: Array<{ type?: string }>;
        };
        todos?: { incompleteCount?: number; items?: unknown };
      };
      expect(getTextContent(dashboardSummaryResult).length).toBeLessThan(
        getTextContent(dashboardResult).length,
      );
      expect(
        dashboardSummaryPayload.subscriptions?.currentSemesterSections,
      ).toBeUndefined();
      expect(
        (dashboardSummaryPayload.upcomingDeadlines?.items?.length ?? 0) <= 3,
      ).toBe(true);
      expect(dashboardSummaryPayload.todos?.items).toBeUndefined();

      const nextClassResult = await mcpClient.callTool({
        name: "get_next_class",
        arguments: {
          locale: "zh-cn",
        },
      });
      const nextClassPayload = parseTextContent(nextClassResult) as {
        found?: boolean;
        nextClass?: { type?: string; at?: string | null };
      };
      expect(typeof nextClassPayload.found).toBe("boolean");
      if (nextClassPayload.found) {
        expect(nextClassPayload.nextClass?.type).toBe("schedule");
      }

      const deadlinesResult = await mcpClient.callTool({
        name: "get_upcoming_deadlines",
        arguments: {
          locale: "zh-cn",
          dayLimit: 7,
        },
      });
      const deadlinesPayload = parseTextContent(deadlinesResult) as {
        total?: number;
        deadlines?: Array<{ type?: string }>;
      };
      expect(typeof deadlinesPayload.total).toBe("number");
      expect(
        deadlinesPayload.deadlines?.every((event) =>
          ["homework_due", "exam", "todo_due"].includes(event.type ?? ""),
        ),
      ).toBe(true);

      const timelineResult = await mcpClient.callTool({
        name: "get_my_7days_timeline",
        arguments: {
          locale: "zh-cn",
          atTime: DEV_SEED_ANCHOR.startOfDayAtTime,
        },
      });
      const timelinePayload = parseTextContent(timelineResult) as {
        total?: number;
        range?: { from?: string; to?: string };
        events?: Array<{ type?: string; at?: string | null }>;
      };
      expect(typeof timelinePayload.total).toBe("number");
      expect(timelinePayload.range?.from).toMatch(/\+08:00$/);
      expect(timelinePayload.range?.to).toMatch(/\+08:00$/);
      expect((timelinePayload.events?.length ?? 0) > 0).toBe(true);
      expect(
        timelinePayload.events?.some(
          (event) => typeof event.at === "string" && /\+08:00$/.test(event.at),
        ),
      ).toBe(true);
      expect(
        timelinePayload.events?.some((event) =>
          ["schedule", "homework_due", "exam", "todo_due"].includes(
            event.type ?? "",
          ),
        ),
      ).toBe(true);
      const timelineSummaryResult = await mcpClient.callTool({
        name: "get_my_7days_timeline",
        arguments: {
          locale: "zh-cn",
          atTime: DEV_SEED_ANCHOR.startOfDayAtTime,
          mode: "summary",
        },
      });
      const timelineSummaryPayload = parseTextContent(
        timelineSummaryResult,
      ) as {
        total?: number;
        events?: {
          total?: number;
          byType?: { schedule?: number };
          days?: Array<{ date?: string; total?: number }>;
          items?: Array<{ type?: string }>;
        };
      };
      expect(getTextContent(timelineSummaryResult).length).toBeLessThan(
        getTextContent(timelineResult).length,
      );
      expect(timelineSummaryPayload.events?.total).toBe(
        timelineSummaryPayload.total,
      );
      expect(typeof timelineSummaryPayload.events?.byType?.schedule).toBe(
        "number",
      );
      expect((timelineSummaryPayload.events?.days?.length ?? 0) > 0).toBe(true);

      const calendarEventsResult = await mcpClient.callTool({
        name: "list_my_calendar_events",
        arguments: {
          dateFrom: DEV_SEED_ANCHOR.startOfDayAtTime,
          dateTo: "2026-05-10T23:59:59+08:00",
          locale: "zh-cn",
        },
      });
      const calendarEventsPayload = parseTextContent(calendarEventsResult) as {
        events?: Array<{ type?: string; at?: string | null }>;
      };
      expect((calendarEventsPayload.events?.length ?? 0) > 0).toBe(true);

      const calendarEventsSummaryResult = await mcpClient.callTool({
        name: "list_my_calendar_events",
        arguments: {
          dateFrom: DEV_SEED_ANCHOR.startOfDayAtTime,
          dateTo: "2026-05-10T23:59:59+08:00",
          locale: "zh-cn",
          mode: "summary",
        },
      });
      const calendarEventsSummaryPayload = parseTextContent(
        calendarEventsSummaryResult,
      ) as {
        events?: {
          total?: number;
          byType?: { schedule?: number };
          days?: Array<{ date?: string; total?: number }>;
        };
      };
      expect(getTextContent(calendarEventsSummaryResult).length).toBeLessThan(
        getTextContent(calendarEventsResult).length,
      );
      expect(typeof calendarEventsSummaryPayload.events?.total).toBe("number");
      expect(typeof calendarEventsSummaryPayload.events?.byType?.schedule).toBe(
        "number",
      );

      const matchSectionCodesResult = await mcpClient.callTool({
        name: "match_section_codes",
        arguments: {
          codes: [DEV_SEED.section.code, "NOT-EXIST-CODE"],
          locale: "zh-cn",
        },
      });
      const matchSectionCodesPayload = parseTextContent(
        matchSectionCodesResult,
      ) as {
        success?: boolean;
        matchedCodes?: string[];
        unmatchedCodes?: string[];
        suggestions?: Record<string, string[]>;
      };
      expect(matchSectionCodesPayload.success).toBe(true);
      expect(matchSectionCodesPayload.matchedCodes).toContain(
        DEV_SEED.section.code,
      );
      expect(matchSectionCodesPayload.unmatchedCodes).toContain(
        "NOT-EXIST-CODE",
      );

      const fuzzySectionCode = DEV_SEED.section.code.replace(/\.\d+$/, ".0");
      const fuzzyMatchSectionCodesResult = await mcpClient.callTool({
        name: "match_section_codes",
        arguments: {
          codes: [fuzzySectionCode],
          locale: "zh-cn",
        },
      });
      const fuzzyMatchPayload = parseTextContent(
        fuzzyMatchSectionCodesResult,
      ) as {
        suggestions?: Record<string, string[]>;
      };
      expect(fuzzyMatchPayload.suggestions?.[fuzzySectionCode]).toEqual([
        DEV_SEED.section.code,
      ]);

      let busResult: Awaited<ReturnType<typeof mcpClient.callTool>> | undefined;
      let busPayload:
        | {
            fetchedAt?: string;
            version?: { title?: string | null };
            counts?: {
              routes?: number;
              weekdayTrips?: number;
              weekendTrips?: number;
            };
            routes?: Array<{ id?: number | null }>;
            nextDepartures?: Array<{
              routeId?: number;
              departureTime?: string | null;
            }>;
            trips?: Array<{
              dayType?: string;
              stopTimes?: Array<{ stopOrder?: number; time?: string | null }>;
            }>;
            preferences?: {
              preferredOriginCampusId?: number | null;
              preferredDestinationCampusId?: number | null;
              showDepartedTrips?: boolean;
            } | null;
          }
        | undefined;
      await expect(async () => {
        const preferenceResponse = await page.request.post(
          "/api/bus/preferences",
          {
            data: {
              preferredOriginCampusId: 1,
              preferredDestinationCampusId: 4,
              showDepartedTrips: true,
            },
          },
        );
        expect(preferenceResponse.status()).toBe(200);
        busResult = await mcpClient.callTool({
          name: "query_bus_timetable",
          arguments: {
            locale: "zh-cn",
          },
        });
        busPayload = parseTextContent(busResult) as typeof busPayload;
        expect(typeof busPayload?.fetchedAt).toBe("string");
        expect(busPayload?.version?.title).toContain(DEV_SEED.bus.versionTitle);
        expect(typeof busPayload?.counts?.routes).toBe("number");
        expect(
          busPayload?.routes?.some(
            (route) => route.id === DEV_SEED.bus.routeId,
          ),
        ).toBe(true);
        expect(busPayload?.trips).toBeUndefined();
        expect(busPayload?.preferences?.preferredOriginCampusId).toBe(1);
        expect(busPayload?.preferences?.preferredDestinationCampusId).toBe(4);
        expect(busPayload?.preferences?.showDepartedTrips).toBe(true);
        expect((busPayload?.nextDepartures?.length ?? 0) > 0).toBe(true);
      }).toPass({
        timeout: 10_000,
        intervals: [250, 500, 1_000],
      });
      if (!busPayload) {
        throw new Error("query_bus_timetable returned no payload");
      }

      const busFullResult = await mcpClient.callTool({
        name: "query_bus_timetable",
        arguments: {
          locale: "zh-cn",
          mode: "full",
        },
      });
      const busFullPayload = parseTextContent(busFullResult) as {
        routes?: Array<{ id?: number | null }>;
        trips?: Array<{
          dayType?: string;
          stopTimes?: Array<{ stopOrder?: number; time?: string | null }>;
        }>;
      };
      expect(
        busFullPayload.routes?.some(
          (route) => route.id === DEV_SEED.bus.routeId,
        ),
      ).toBe(true);
      expect(
        busFullPayload.trips?.some(
          (trip) => trip.dayType === "weekday" || trip.dayType === "weekend",
        ),
      ).toBe(true);
      expect(
        busFullPayload.trips?.some(
          (trip) =>
            Array.isArray(trip.stopTimes) &&
            trip.stopTimes.some(
              (stopTime) => typeof stopTime.stopOrder === "number",
            ),
        ),
      ).toBe(true);

      const busSummaryResult = await mcpClient.callTool({
        name: "query_bus_timetable",
        arguments: {
          locale: "zh-cn",
          mode: "summary",
        },
      });
      const busSummaryPayload = parseTextContent(busSummaryResult) as {
        counts?: {
          routes?: number;
          weekdayTrips?: number;
          weekendTrips?: number;
        };
        nextDepartures?: Array<{
          routeId?: number;
          departureTime?: string | null;
        }>;
        nextDeparturesMessage?: string | null;
      };
      expect(typeof busSummaryPayload.counts?.routes).toBe("number");
      expect(typeof busSummaryPayload.counts?.weekdayTrips).toBe("number");
      expect(typeof busSummaryPayload.counts?.weekendTrips).toBe("number");
      expect((busSummaryPayload.nextDepartures?.length ?? 0) > 0).toBe(true);
      expect(busResult).toBeDefined();
      const fullBusTextLength = getTextContent(busResult ?? []).length;
      expect(getTextContent(busSummaryResult).length).toBeLessThan(
        fullBusTextLength,
      );
      if (busSummaryPayload.nextDepartures?.length === 0) {
        expect(typeof busSummaryPayload.nextDeparturesMessage).toBe("string");
      }

      // list_bus_routes — lightweight route catalog
      const listRoutesResult = await mcpClient.callTool({
        name: "list_bus_routes",
        arguments: { locale: "zh-cn" },
      });
      const listRoutesPayload = parseTextContent(listRoutesResult) as {
        routes?: Array<{
          id?: number;
          stops?: Array<{ campusId?: number }>;
        }>;
        campuses?: Array<{ id?: number }>;
      };
      expect(Array.isArray(listRoutesPayload.routes)).toBe(true);
      expect(listRoutesPayload.routes?.length).toBeGreaterThan(0);
      expect(Array.isArray(listRoutesPayload.campuses)).toBe(true);
      expect(
        listRoutesPayload.routes?.some((r) => r.id === DEV_SEED.bus.routeId),
      ).toBe(true);
      const queryRouteIds = new Set(
        (busPayload.routes ?? [])
          .map((route) => route.id)
          .filter((routeId): routeId is number => typeof routeId === "number"),
      );
      const listedRouteIds = new Set(
        (listRoutesPayload.routes ?? [])
          .map((route) => route.id)
          .filter((routeId): routeId is number => typeof routeId === "number"),
      );
      expect(listedRouteIds.size).toBeGreaterThan(0);
      expect(
        [...listedRouteIds].every((routeId) => queryRouteIds.has(routeId)),
      ).toBe(true);

      // get_bus_route_timetable — full weekday+weekend for one route
      const timetableResult = await mcpClient.callTool({
        name: "get_bus_route_timetable",
        arguments: {
          routeId: DEV_SEED.bus.routeId,
          locale: "zh-cn",
        },
      });
      const timetablePayload = parseTextContent(timetableResult) as {
        route?: { id?: number };
        weekday?: Array<{
          position?: number;
          stopTimes?: Array<{ stopOrder?: number; time?: string | null }>;
        }>;
        weekend?: Array<{
          position?: number;
          stopTimes?: Array<{ stopOrder?: number; time?: string | null }>;
        }>;
        alternateRoutes?: Array<{ id?: number }>;
      };
      expect(timetablePayload.route?.id).toBe(DEV_SEED.bus.routeId);
      expect(Array.isArray(timetablePayload.weekday)).toBe(true);
      expect(Array.isArray(timetablePayload.weekend)).toBe(true);
      expect(Array.isArray(timetablePayload.alternateRoutes)).toBe(true);
      expect(
        timetablePayload.weekday?.some(
          (trip) =>
            Array.isArray(trip.stopTimes) &&
            trip.stopTimes.some(
              (stopTime) => typeof stopTime.stopOrder === "number",
            ),
        ),
      ).toBe(true);

      const searchRoutesResult = await mcpClient.callTool({
        name: "search_bus_routes",
        arguments: {
          locale: "zh-cn",
          originCampusId: DEV_SEED.bus.originCampusId,
          destinationCampusId: DEV_SEED.bus.destinationCampusId,
        },
      });
      const searchRoutesPayload = parseTextContent(searchRoutesResult) as {
        total?: number;
        routes?: Array<{ id?: number }>;
      };
      expect(searchRoutesPayload.total).toBeGreaterThan(0);
      expect(
        searchRoutesPayload.routes?.some(
          (route) => route.id === DEV_SEED.bus.recommendedRouteId,
        ),
      ).toBe(true);

      const nextBusesResult = await mcpClient.callTool({
        name: "get_next_buses",
        arguments: {
          locale: "zh-cn",
          originCampusId: DEV_SEED.bus.originCampusId,
          destinationCampusId: DEV_SEED.bus.destinationCampusId,
        },
      });
      const nextBusesPayload = parseTextContent(nextBusesResult) as {
        totalRoutes?: number;
        departures?: Array<{
          routeId?: number;
          departureTime?: string | null;
          originCampus?: unknown;
          destinationCampus?: unknown;
        }>;
        message?: string | null;
        nextAvailableDeparture?: {
          routeId?: number;
          departureTime?: string | null;
        } | null;
      };
      expect(nextBusesPayload.totalRoutes).toBeGreaterThan(0);
      if ((nextBusesPayload.departures?.length ?? 0) > 0) {
        expect(
          nextBusesPayload.departures?.every(
            (departure) =>
              typeof departure.routeId === "number" &&
              typeof departure.departureTime === "string" &&
              !Object.hasOwn(departure, "originCampus") &&
              !Object.hasOwn(departure, "destinationCampus"),
          ),
        ).toBe(true);
      } else {
        expect(typeof nextBusesPayload.message).toBe("string");
        if (nextBusesPayload.nextAvailableDeparture) {
          expect(typeof nextBusesPayload.nextAvailableDeparture.routeId).toBe(
            "number",
          );
        }
      }

      // get_bus_route_timetable — invalid route returns error message
      const invalidTimetableResult = await mcpClient.callTool({
        name: "get_bus_route_timetable",
        arguments: { routeId: 99999, locale: "zh-cn" },
      });
      const invalidPayload = parseTextContent(invalidTimetableResult) as {
        hasData?: boolean;
        message?: string;
      };
      expect(invalidPayload.hasData).toBe(false);

      const todoTitle = `[MCP-E2E-TODO] ${Date.now()}`;
      const createTodoResult = await mcpClient.callTool({
        name: "create_my_todo",
        arguments: {
          title: todoTitle,
          content: "todo created by mcp e2e",
          priority: "medium",
          dueAt: new Date().toISOString(),
        },
      });
      const createTodoPayload = parseTextContent(createTodoResult) as {
        success?: boolean;
        id?: string;
      };
      expect(createTodoPayload.success).toBe(true);
      expect(typeof createTodoPayload.id).toBe("string");

      const updateTodoResult = await mcpClient.callTool({
        name: "update_my_todo",
        arguments: {
          id: createTodoPayload.id,
          title: `${todoTitle}-updated`,
          completed: true,
        },
      });
      const updateTodoPayload = parseTextContent(updateTodoResult) as {
        success?: boolean;
      };
      expect(updateTodoPayload.success).toBe(true);

      const deleteTodoResult = await mcpClient.callTool({
        name: "delete_my_todo",
        arguments: {
          id: createTodoPayload.id,
        },
      });
      const deleteTodoPayload = parseTextContent(deleteTodoResult) as {
        success?: boolean;
      };
      expect(deleteTodoPayload.success).toBe(true);

      const homeworkTitle = `[MCP-E2E-HW] ${Date.now()}`;
      const createHomeworkResult = await mcpClient.callTool({
        name: "create_homework_on_section",
        arguments: {
          sectionJwId: DEV_SEED.section.jwId,
          title: homeworkTitle,
          description: "homework created by mcp e2e",
          publishedAt: "2026-04-29T09:00:00+08:00",
          submissionStartAt: "2026-04-29T09:00:00+08:00",
          submissionDueAt: "2026-05-12T23:00:00+08:00",
          locale: "zh-cn",
        },
      });
      const createHomeworkPayload = parseTextContent(createHomeworkResult) as {
        success?: boolean;
        id?: string;
        homework?: {
          id?: string;
          title?: string;
          section?: { jwId?: number };
          commentCount?: number;
        } | null;
      };
      expect(createHomeworkPayload.success).toBe(true);
      expect(typeof createHomeworkPayload.id).toBe("string");
      expect(createHomeworkPayload.homework?.id).toBe(createHomeworkPayload.id);
      expect(createHomeworkPayload.homework?.title).toBe(homeworkTitle);
      expect(createHomeworkPayload.homework?.section?.jwId).toBe(
        DEV_SEED.section.jwId,
      );
      expect(typeof createHomeworkPayload.homework?.commentCount).toBe(
        "number",
      );

      const updateHomeworkResult = await mcpClient.callTool({
        name: "update_homework_on_section",
        arguments: {
          homeworkId: createHomeworkPayload.id,
          title: `${homeworkTitle}-updated`,
          description: "homework updated by mcp e2e",
          requiresTeam: true,
          submissionDueAt: "2026-05-15T23:00:00+08:00",
        },
      });
      const updateHomeworkPayload = parseTextContent(updateHomeworkResult) as {
        success?: boolean;
        homework?: {
          id?: string;
          title?: string;
          requiresTeam?: boolean;
          description?: { content?: string } | null;
        } | null;
      };
      expect(updateHomeworkPayload.success).toBe(true);
      expect(updateHomeworkPayload.homework?.id).toBe(createHomeworkPayload.id);
      expect(updateHomeworkPayload.homework?.title).toBe(
        `${homeworkTitle}-updated`,
      );
      expect(updateHomeworkPayload.homework?.requiresTeam).toBe(true);
      expect(updateHomeworkPayload.homework?.description?.content).toBe(
        "homework updated by mcp e2e",
      );

      const calendarSubscriptionResult = await mcpClient.callTool({
        name: "get_my_calendar_subscription",
        arguments: {
          locale: "zh-cn",
        },
      });
      const calendarSubscriptionPayload = parseTextContent(
        calendarSubscriptionResult,
      ) as {
        success?: boolean;
        subscription?: {
          userId?: string;
          currentSemesterSections?: Array<{ id?: number }>;
          sections?: Array<{ id?: number }>;
          calendarPath?: string;
        };
      };
      expect(calendarSubscriptionPayload.success).toBe(true);
      expect(calendarSubscriptionPayload.subscription?.userId).toBe(
        currentUser.id,
      );
      expect(
        (calendarSubscriptionPayload.subscription?.currentSemesterSections
          ?.length ?? 0) > 0,
      ).toBe(true);
      expect(
        calendarSubscriptionPayload.subscription?.sections,
      ).toBeUndefined();
      expect(calendarSubscriptionPayload.subscription?.calendarPath).toContain(
        "/api/users/",
      );

      const calendarSubscriptionSummaryResult = await mcpClient.callTool({
        name: "get_my_calendar_subscription",
        arguments: {
          locale: "zh-cn",
          mode: "summary",
        },
      });
      const calendarSubscriptionSummaryPayload = parseTextContent(
        calendarSubscriptionSummaryResult,
      ) as {
        subscription?: {
          sectionCount?: number;
          currentSemesterSectionCount?: number;
          calendarPath?: string;
        };
      };
      expect(
        calendarSubscriptionSummaryPayload.subscription?.sectionCount,
      ).toBeGreaterThan(0);
      expect(
        (
          calendarSubscriptionSummaryPayload.subscription as
            | {
                currentSemesterSections?: unknown;
              }
            | undefined
        )?.currentSemesterSections,
      ).toBeUndefined();
      expect(
        calendarSubscriptionSummaryPayload.subscription?.calendarPath,
      ).toContain("[redacted]");

      const subscribeResult = await mcpClient.callTool({
        name: "subscribe_my_sections_by_codes",
        arguments: {
          codes: [DEV_SEED.section.code],
          locale: "zh-cn",
        },
      });
      const subscribePayload = parseTextContent(subscribeResult) as {
        success?: boolean;
        matchedCodes?: string[];
        subscription?: {
          sectionCount?: number;
          currentSemesterSections?: unknown;
          sections?: unknown;
        } | null;
      };
      expect(subscribePayload.success).toBe(true);
      expect(subscribePayload.matchedCodes).toContain(DEV_SEED.section.code);
      expect(typeof subscribePayload.subscription?.sectionCount).toBe("number");
      expect(
        subscribePayload.subscription?.currentSemesterSections,
      ).toBeUndefined();
      expect(subscribePayload.subscription?.sections).toBeUndefined();

      const missingSectionResult = await mcpClient.callTool({
        name: "get_section_by_jw_id",
        arguments: {
          jwId: 999999999,
          locale: "zh-cn",
        },
      });
      const missingSectionPayload = parseTextContent(missingSectionResult) as {
        found?: boolean;
        message?: string;
      };
      expect(missingSectionPayload.found).toBe(false);
      expect(missingSectionPayload.message).toContain("999999999");
    } finally {
      await transport.close();
      await page.request.post("/api/calendar-subscriptions", {
        data: { sectionIds: originalSectionIds },
      });
      await resetBusPreference(page.request);
    }
  });
});
