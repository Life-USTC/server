/**
 * E2E tests for /oauth/device — Device Authorization Grant (RFC 8628)
 *
 * ## Data Represented (oauth.yml → device-authorization-grant.display.fields)
 * - User code entry form
 * - Approval/result screens
 * - device_auth status (pending/approved/denied)
 *
 * ## Features
 * - POST /api/auth/oauth2/device-authorization → { device_code, user_code, verification_uri, ... }
 * - /oauth/device page renders user code entry form anonymously
 * - Unauthenticated pending approval link → redirect to /signin
 * - After login → approval/denial screen
 * - Approved, scoped resource-bound device token can authenticate REST and MCP
 *
 * ## Edge Cases
 * - Invalid user code → shows error
 * - Expired user code → shows error
 */
import {
  type APIRequestContext,
  expect,
  type Page,
  type TestInfo,
  test,
} from "@playwright/test";
import {
  OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { restReadScope, restWriteScope } from "@/lib/oauth/scope-registry";
import { signInAsDebugUser } from "../../../../utils/auth";
import {
  createOAuthClientFixture,
  deleteOAuthClientsByName,
  disableOAuthClientByName,
  PLAYWRIGHT_BASE_URL,
} from "../../../../utils/e2e-db";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import {
  capturePageScreenshot,
  captureStepScreenshot,
} from "../../../../utils/screenshot";

type DeviceAuthorizationResult = {
  clientId: string;
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
};

const DEVICE_MCP_CLIENT_SCOPES = [
  "openid",
  "profile",
  restReadScope("me"),
  restReadScope("todo"),
  restWriteScope("todo"),
  OAUTH_OFFLINE_ACCESS_SCOPE,
];

async function registerDeviceClient(
  clientName: string,
  options: {
    grantTypes?: string[];
    scopes?: string[];
  } = {},
) {
  const client = await createOAuthClientFixture({
    name: clientName,
    redirectUris: [`${PLAYWRIGHT_BASE_URL}/e2e/device/callback`],
    tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
    grantTypes: options.grantTypes ?? [OAUTH_DEVICE_CODE_GRANT_TYPE],
    scopes: options.scopes ?? ["openid", "profile"],
  });
  return client.clientId;
}

function getVerificationPath(verificationUriComplete: string) {
  const url = new URL(verificationUriComplete);
  return `${url.pathname}${url.search}`;
}

async function requestDeviceCode(
  request: APIRequestContext,
  clientName: string,
  options: {
    clientScopes?: string[];
    resources?: string[];
    scope?: string;
  } = {},
): Promise<DeviceAuthorizationResult> {
  const clientId = await registerDeviceClient(clientName, {
    scopes: options.clientScopes,
  });
  const form = new URLSearchParams({
    client_id: clientId,
    scope: options.scope ?? "openid profile",
  });
  for (const resource of options.resources ?? []) {
    form.append("resource", resource);
  }

  const deviceResponse = await request.post(
    "/api/auth/oauth2/device-authorization",
    {
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: PLAYWRIGHT_BASE_URL,
      },
      data: form.toString(),
    },
  );
  const deviceResponseText = await deviceResponse.text();
  expect(deviceResponse.status(), deviceResponseText).toBe(200);

  const deviceBody = JSON.parse(deviceResponseText) as {
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
    verification_uri_complete?: string;
    expires_in?: number;
    interval?: number;
  };
  expect(typeof deviceBody.device_code).toBe("string");
  expect(typeof deviceBody.user_code).toBe("string");
  expect(typeof deviceBody.verification_uri).toBe("string");
  expect(typeof deviceBody.verification_uri_complete).toBe("string");
  expect(typeof deviceBody.expires_in).toBe("number");
  expect(typeof deviceBody.interval).toBe("number");

  return {
    clientId,
    deviceCode: deviceBody.device_code as string,
    userCode: deviceBody.user_code as string,
    verificationUri: deviceBody.verification_uri as string,
    verificationUriComplete: deviceBody.verification_uri_complete as string,
    expiresIn: deviceBody.expires_in as number,
    interval: deviceBody.interval as number,
  };
}

async function approveDeviceCode(
  page: Page,
  result: DeviceAuthorizationResult,
  options: {
    screenshot?: { label: string; testInfo: TestInfo };
    visibleResources?: string[];
  } = {},
) {
  await signInAsDebugUser(
    page,
    getVerificationPath(result.verificationUriComplete),
  );
  for (const resource of options.visibleResources ?? []) {
    await expect(page.getByText(resource, { exact: true })).toBeVisible();
  }
  if (options.screenshot) {
    await capturePageScreenshot(page, options.screenshot.testInfo, {
      url: page.url(),
      label: options.screenshot.label,
    });
  }
  await page.getByRole("button", { name: /允许|Allow|批准|Approve/i }).click();
  await expect(page).toHaveURL(/\/oauth\/device\?result=approved/);
}

async function exchangeDeviceToken(
  request: APIRequestContext,
  result: DeviceAuthorizationResult,
  resources: string[],
) {
  const form = new URLSearchParams({
    grant_type: OAUTH_DEVICE_CODE_GRANT_TYPE,
    client_id: result.clientId,
    device_code: result.deviceCode,
  });
  for (const resource of resources) {
    form.append("resource", resource);
  }

  const tokenResponse = await request.post("/api/auth/oauth2/token", {
    headers: { "content-type": "application/x-www-form-urlencoded" },
    data: form.toString(),
  });
  const tokenText = await tokenResponse.text();
  expect(tokenResponse.status(), tokenText).toBe(200);
  const tokenBody = JSON.parse(tokenText) as {
    access_token?: string;
    refresh_token?: string;
  };
  expect(typeof tokenBody.access_token).toBe("string");
  return {
    accessToken: tokenBody.access_token as string,
    refreshToken: tokenBody.refresh_token,
  };
}

test("/oauth/device 页面渲染用户代码输入表单", async ({ page }, testInfo) => {
  await gotoAndWaitForReady(page, "/oauth/device");

  await expect(
    page.locator('input#code, input[type="text"][name="code"]').first(),
  ).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: /Verify|确认|Confirm|Submit|提交|验证/i })
      .first(),
  ).toBeVisible();

  await captureStepScreenshot(page, testInfo, "oauth/device/form");
});

test("/oauth/device 无效用户代码显示公开错误", async ({ page }, testInfo) => {
  await gotoAndWaitForReady(page, "/oauth/device?code=NOPE-NOPE&step=approve");

  await expect(
    page.getByText(/未找到|not found|No device login request/i).first(),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/\/signin(?:\?.*)?$/);
  await captureStepScreenshot(page, testInfo, "oauth/device/invalid-code");
});

test("/oauth/device 设备授权端点返回必要字段", async ({ request }) => {
  const clientName = `device-e2e-${Date.now()}`;
  try {
    const result = await requestDeviceCode(request, clientName);
    const verificationUrl = new URL(result.verificationUriComplete);

    expect(result.verificationUri).toBe(`${PLAYWRIGHT_BASE_URL}/oauth/device`);
    expect(verificationUrl.origin).toBe(PLAYWRIGHT_BASE_URL);
    expect(verificationUrl.pathname).toBe("/oauth/device");
    expect(verificationUrl.searchParams.get("code")).toBe(result.userCode);
    expect(verificationUrl.searchParams.get("step")).toBe("approve");
    expect(result.expiresIn).toBeGreaterThan(0);
    expect(result.interval).toBeGreaterThan(0);
  } finally {
    await deleteOAuthClientsByName(clientName);
  }
});

test("/oauth/device 拒绝超出客户端允许范围的 scope", async ({ request }) => {
  const clientName = `device-e2e-invalid-scope-${Date.now()}`;
  try {
    const clientId = await registerDeviceClient(clientName);
    const response = await request.post(
      "/api/auth/oauth2/device-authorization",
      {
        headers: {
          origin: PLAYWRIGHT_BASE_URL,
        },
        form: {
          client_id: clientId,
          scope: "openid profile unsupported:e2e-scope",
        },
      },
    );

    const responseText = await response.text();
    expect(response.status(), responseText).toBe(400);
    expect(JSON.parse(responseText)).toMatchObject({
      error: "invalid_scope",
      error_description: "Requested scope is not allowed for this client",
    });
  } finally {
    await deleteOAuthClientsByName(clientName);
  }
});

test("/oauth/device 拒绝未注册设备授权类型的客户端", async ({ request }) => {
  const clientName = `device-e2e-unsupported-grant-${Date.now()}`;
  try {
    const clientId = await registerDeviceClient(clientName, {
      grantTypes: [OAUTH_AUTHORIZATION_CODE_GRANT_TYPE],
    });
    const response = await request.post(
      "/api/auth/oauth2/device-authorization",
      {
        headers: {
          origin: PLAYWRIGHT_BASE_URL,
        },
        form: {
          client_id: clientId,
          scope: "openid profile",
        },
      },
    );

    const responseText = await response.text();
    expect(response.status(), responseText).toBe(400);
    expect(JSON.parse(responseText)).toMatchObject({
      error: "unauthorized_client",
      error_description: "Client is not registered for device authorization",
    });
  } finally {
    await deleteOAuthClientsByName(clientName);
  }
});

test("/oauth/device 未登录的待批准请求重定向到登录页", async ({
  page,
  request,
}, testInfo) => {
  const clientName = `device-e2e-redirect-${Date.now()}`;
  try {
    const result = await requestDeviceCode(request, clientName);
    const verificationPath = getVerificationPath(
      result.verificationUriComplete,
    );

    await gotoAndWaitForReady(page, verificationPath, {
      expectMainContent: false,
    });

    await expect(page).toHaveURL(/\/signin(?:\?.*)?$/, { timeout: 10_000 });
    expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe(
      verificationPath,
    );
    await captureStepScreenshot(
      page,
      testInfo,
      "oauth/device/redirect-to-signin",
    );
  } finally {
    await deleteOAuthClientsByName(clientName);
  }
});

test("/oauth/device 已登录用户看到批准界面", async ({
  page,
  request,
}, testInfo) => {
  const clientName = `device-e2e-approval-${Date.now()}`;
  try {
    const result = await requestDeviceCode(request, clientName);
    const verificationPath = getVerificationPath(
      result.verificationUriComplete,
    );

    await signInAsDebugUser(page, verificationPath);

    await expect(
      page
        .getByRole("button", { name: /允许|Allow|批准|Approve/i })
        .or(page.getByRole("button", { name: /拒绝|Deny/i }))
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    await captureStepScreenshot(page, testInfo, "oauth/device/approval-screen");
  } finally {
    await deleteOAuthClientsByName(clientName);
  }
});

test("/oauth/device 资源绑定令牌可访问 REST 与 MCP", async ({
  page,
  request,
}, testInfo) => {
  const clientName = `device-e2e-resource-token-${Date.now()}`;
  const restResource = `${PLAYWRIGHT_BASE_URL}/api/auth`;
  const mcpResource = `${PLAYWRIGHT_BASE_URL}/api/mcp`;
  const resources = [restResource, mcpResource];
  try {
    const result = await requestDeviceCode(request, clientName, {
      clientScopes: DEVICE_MCP_CLIENT_SCOPES,
      resources,
      scope: DEVICE_MCP_CLIENT_SCOPES.join(" "),
    });

    await approveDeviceCode(page, result, {
      screenshot: { label: "resource-approval", testInfo },
      visibleResources: resources,
    });
    const { accessToken, refreshToken } = await exchangeDeviceToken(
      request,
      result,
      resources,
    );
    expect(accessToken.split(".")).toHaveLength(3);
    expect(refreshToken).toBeUndefined();

    const todosResponse = await request.get("/api/todos", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    expect(todosResponse.status()).toBe(200);

    const mcpResponse = await request.post("/api/mcp", {
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: {
            name: "device-flow-e2e-client",
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
    expect(mcpResponse.status()).toBe(200);
  } finally {
    await deleteOAuthClientsByName(clientName);
  }
});

test("/oauth/device 仅 profile 的 REST 令牌被受保护 REST 拒绝", async ({
  page,
  request,
}) => {
  const clientName = `device-e2e-profile-rest-token-${Date.now()}`;
  const restResource = `${PLAYWRIGHT_BASE_URL}/api/auth`;
  const scopes = ["openid", "profile"];
  try {
    const result = await requestDeviceCode(request, clientName, {
      clientScopes: scopes,
      resources: [restResource],
      scope: scopes.join(" "),
    });

    await approveDeviceCode(page, result, {
      visibleResources: [restResource],
    });
    const { accessToken } = await exchangeDeviceToken(request, result, [
      restResource,
    ]);
    expect(accessToken.split(".")).toHaveLength(3);

    const todosResponse = await request.get("/api/todos", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    expect(todosResponse.status()).toBe(401);
    await expect(todosResponse.json()).resolves.toEqual({
      error: "Unauthorized",
    });
  } finally {
    await deleteOAuthClientsByName(clientName);
  }
});

test("/oauth/device 含其他 feature scope 但无 todo scope 的令牌被 todo REST 拒绝", async ({
  page,
  request,
}) => {
  const clientName = `device-e2e-feature-rest-token-${Date.now()}`;
  const restResource = `${PLAYWRIGHT_BASE_URL}/api/auth`;
  const scopes = ["openid", "profile", restReadScope("schedule")];
  const resources = [restResource];
  try {
    const result = await requestDeviceCode(request, clientName, {
      clientScopes: scopes,
      resources,
      scope: scopes.join(" "),
    });

    await approveDeviceCode(page, result, {
      visibleResources: resources,
    });
    const { accessToken } = await exchangeDeviceToken(
      request,
      result,
      resources,
    );
    expect(accessToken.split(".")).toHaveLength(3);

    const todosResponse = await request.get("/api/todos", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    expect(todosResponse.status()).toBe(401);
    await expect(todosResponse.json()).resolves.toEqual({
      error: "Unauthorized",
    });
  } finally {
    await deleteOAuthClientsByName(clientName);
  }
});

test("/oauth/device 已禁用客户端代码显示错误而非批准界面", async ({
  page,
  request,
}, testInfo) => {
  const clientName = `device-e2e-disabled-${Date.now()}`;
  try {
    const result = await requestDeviceCode(request, clientName);
    const verificationPath = getVerificationPath(
      result.verificationUriComplete,
    );

    await disableOAuthClientByName(clientName);
    await gotoAndWaitForReady(page, verificationPath, {
      expectMainContent: false,
    });

    await expect(page).not.toHaveURL(/\/signin(?:\?.*)?$/);
    await expect(
      page.getByText(/invalid or has expired|无效|已过期/i).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /允许|Allow|批准|Approve/i }),
    ).toHaveCount(0);
    await captureStepScreenshot(page, testInfo, "oauth/device/disabled-client");
  } finally {
    await deleteOAuthClientsByName(clientName);
  }
});

test("/oauth/device 发现文档包含设备授权端点", async ({ request }) => {
  const discoveryResponse = await request.get(
    "/api/auth/.well-known/openid-configuration",
  );
  expect(discoveryResponse.status()).toBe(200);
  const discovery = (await discoveryResponse.json()) as {
    device_authorization_endpoint?: string;
    grant_types_supported?: string[];
  };

  expect(typeof discovery.device_authorization_endpoint).toBe("string");
  expect(discovery.device_authorization_endpoint).toContain(
    "/oauth2/device-authorization",
  );
  expect(
    discovery.grant_types_supported?.includes(
      "urn:ietf:params:oauth:grant-type:device_code",
    ),
  ).toBe(true);
});
