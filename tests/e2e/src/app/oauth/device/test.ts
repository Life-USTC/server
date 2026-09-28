/**
 * E2E tests for /oauth/device — Device Authorization Grant (RFC 8628)
 *
 * ## Data Represented (docs/features/oauth.yaml → device-authorization-grant)
 * - User code entry form
 * - Approval/result screens
 * - device_auth status (pending/approved/denied)
 *
 * ## Features
 * - POST /api/auth/oauth2/device-authorization → { device_code, user_code, verification_uri, ... }
 * - /oauth/device page renders user code entry form anonymously
 * - Unauthenticated pending approval link → redirect to /account/sign-in
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
  OAUTH_CODE_RESPONSE_TYPE,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { restReadScope, restWriteScope } from "@/lib/oauth/scope-registry";
import {
  type IsolatedWorker,
  test as isolatedTest,
} from "../../../../utils/isolated-worker";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import {
  capturePageScreenshot,
  captureStepScreenshot,
} from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

test.describe.configure({ mode: "parallel" });
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
  restReadScope("account.profile"),
  restReadScope("workspace.todo"),
  restWriteScope("workspace.todo"),
  OAUTH_OFFLINE_ACCESS_SCOPE,
];
async function registerDeviceClient(
  worker: IsolatedWorker,
  clientName: string,
  options: {
    grantTypes?: string[];
    scopes?: string[];
  } = {},
) {
  const client = await worker.database.owner.oAuthClient.create({
    data: {
      name: clientName,
      clientId: crypto.randomUUID(),
      clientSecret: crypto.randomUUID(),
      redirectUris: [`${worker.origin}/e2e/device/callback`],
      type: "public",
      disabled: false,
      tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
      grantTypes: options.grantTypes ?? [OAUTH_DEVICE_CODE_GRANT_TYPE],
      scopes: options.scopes ?? ["openid", "profile"],
      responseTypes: [OAUTH_CODE_RESPONSE_TYPE],
      requirePKCE: true,
      metadata: { source: "e2e_fixture" },
    },
  });
  return client.clientId;
}
function getVerificationPath(verificationUriComplete: string) {
  const url = new URL(verificationUriComplete);
  return `${url.pathname}${url.search}`;
}
async function requestDeviceCode(
  worker: IsolatedWorker,
  request: APIRequestContext,
  clientName: string,
  options: {
    clientScopes?: string[];
    resources?: string[];
    scope?: string;
  } = {},
): Promise<DeviceAuthorizationResult> {
  const clientId = await registerDeviceClient(worker, clientName, {
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
        origin: worker.origin,
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
  worker: IsolatedWorker,
  page: Page,
  result: DeviceAuthorizationResult,
  options: {
    screenshot?: {
      label: string;
      testInfo: TestInfo;
    };
    visibleResources?: string[];
  } = {},
) {
  const actor = await worker.createActor();
  await page.context().addCookies([actor.cookie]);
  await gotoAndWaitForReady(
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
  expect(
    await worker.database.owner.deviceCode.findUniqueOrThrow({
      where: { deviceCode: result.deviceCode },
    }),
  ).toMatchObject({ status: "approved", userId: actor.id });
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
test("/oauth/device 移动端只呈现一个标题和一个代码输入", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndWaitForReady(page, "/oauth/device");
  await expect(
    page.getByRole("heading", {
      name: /设备登录|Device Login/i,
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    page.getByText(/^(设备登录|Device Login)$/, { exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByText(
      /输入设备上显示的验证码。|Enter the code displayed on your device\./i,
      { exact: true },
    ),
  ).toHaveCount(1);
  const codeInputs = page.locator('input[name="code"]');
  await expect(codeInputs).toHaveCount(1);
  await expect(codeInputs).toBeVisible();
  await expect(page.locator('label[for="code"]')).toHaveCount(1);
  await expect(
    page.getByText(/^(设备验证码|Device Code)$/, { exact: true }),
  ).toHaveCount(1);
  await expect(page.locator('[data-slot="input-otp-slot"]')).toHaveCount(8);
  const otpMetrics = await page
    .locator('[data-slot="input-otp"]')
    .evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
  expect(otpMetrics.scrollWidth).toBeLessThanOrEqual(
    otpMetrics.clientWidth + 1,
  );
  const verifyButton = page.getByRole("button", {
    name: /^(验证|Verify)$/i,
    exact: true,
  });
  await expect(verifyButton).toHaveCount(1);
  await expect(verifyButton).toBeVisible();
  await expect(verifyButton).toBeInViewport();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await captureStepScreenshot(page, testInfo, "oauth/device/form-mobile");
});
test("/oauth/device 320px 和 375px 输入槽完整显示", async ({
  page,
}, testInfo) => {
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await gotoAndWaitForReady(page, "/oauth/device", { testInfo });
    const otp = page.locator('[data-slot="input-otp"]');
    await expect(otp).toBeVisible();
    await expect(page.locator('[data-slot="input-otp-slot"]')).toHaveCount(8);
    const metrics = await otp.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    const card = page.locator('[data-slot="card"]');
    const cardBox = await card.boundingBox();
    if (!cardBox) throw new Error("Device code Card is not visible");
    for (const slot of await page
      .locator('[data-slot="input-otp-slot"]')
      .all()) {
      const slotBox = await slot.boundingBox();
      if (!slotBox) throw new Error("Device code slot is not visible");
      expect(slotBox.x).toBeGreaterThanOrEqual(cardBox.x - 1);
      expect(slotBox.x + slotBox.width).toBeLessThanOrEqual(
        cardBox.x + cardBox.width + 1,
      );
    }
  }
});
test("/oauth/device 无效用户代码显示公开错误", async ({ page }, testInfo) => {
  await gotoAndWaitForReady(page, "/oauth/device?code=NOPE-NOPE&step=approve");
  await expect(
    page.getByText(/未找到|not found|No device login request/i).first(),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/\/account\/sign-in(?:\?.*)?$/);
  await captureStepScreenshot(page, testInfo, "oauth/device/invalid-code");
});
isolatedTest(
  "/oauth/device 设备授权端点返回必要字段",
  async ({ isolatedWorker, request }) => {
    const clientName = `device-e2e-${Date.now()}`;
    const result = await requestDeviceCode(isolatedWorker, request, clientName);
    const verificationUrl = new URL(result.verificationUriComplete);
    expect(result.verificationUri).toBe(
      `${isolatedWorker.origin}/oauth/device`,
    );
    expect(verificationUrl.origin).toBe(isolatedWorker.origin);
    expect(verificationUrl.pathname).toBe("/oauth/device");
    expect(verificationUrl.searchParams.get("code")).toBe(result.userCode);
    expect(verificationUrl.searchParams.get("step")).toBe("approve");
    expect(result.expiresIn).toBeGreaterThan(0);
    expect(result.interval).toBeGreaterThan(0);
  },
);
isolatedTest(
  "/oauth/device 拒绝超出客户端允许范围的 scope",
  async ({ isolatedWorker, request }) => {
    const clientName = `device-e2e-invalid-scope-${Date.now()}`;
    const clientId = await registerDeviceClient(isolatedWorker, clientName);
    const response = await request.post(
      "/api/auth/oauth2/device-authorization",
      {
        headers: {
          origin: isolatedWorker.origin,
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
  },
);
isolatedTest(
  "/oauth/device 拒绝未注册设备授权类型的客户端",
  async ({ isolatedWorker, request }) => {
    const clientName = `device-e2e-unsupported-grant-${Date.now()}`;
    const clientId = await registerDeviceClient(isolatedWorker, clientName, {
      grantTypes: [OAUTH_AUTHORIZATION_CODE_GRANT_TYPE],
    });
    const response = await request.post(
      "/api/auth/oauth2/device-authorization",
      {
        headers: {
          origin: isolatedWorker.origin,
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
  },
);
isolatedTest(
  "/oauth/device 未登录的待批准请求重定向到登录页",
  async ({ isolatedWorker, page, request }, testInfo) => {
    const clientName = `device-e2e-redirect-${Date.now()}`;
    const result = await requestDeviceCode(isolatedWorker, request, clientName);
    const verificationPath = getVerificationPath(
      result.verificationUriComplete,
    );
    await gotoAndWaitForReady(page, verificationPath, {
      expectMainContent: false,
    });
    await expect(page).toHaveURL(/\/account\/sign-in(?:\?.*)?$/, {
      timeout: 10000,
    });
    expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe(
      verificationPath,
    );
    await captureStepScreenshot(
      page,
      testInfo,
      "oauth/device/redirect-to-signin",
    );
  },
);
isolatedTest(
  "/oauth/device 已登录用户看到批准界面",
  async ({ isolatedWorker, page, request }, testInfo) => {
    const clientName = `device-e2e-approval-${Date.now()}`;
    const result = await requestDeviceCode(isolatedWorker, request, clientName);
    const actor = await isolatedWorker.createActor();
    await page.context().addCookies([actor.cookie]);
    await gotoAndWaitForReady(page, "/oauth/device");
    await page
      .locator('input[name="code"]')
      .fill(result.userCode.replace("-", ""));
    await page.getByRole("button", { name: /^(验证|Verify)$/i }).click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === "/oauth/device" &&
        url.searchParams.get("step") === "approve" &&
        url.searchParams.get("code") === result.userCode.replace("-", ""),
    );
    await expect(
      page.getByRole("button", { name: /拒绝|Deny/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /允许|Allow|批准|Approve/i }),
    ).toBeVisible({ timeout: 15000 });
    await captureStepScreenshot(page, testInfo, "oauth/device/approval-screen");
  },
);
isolatedTest(
  "/oauth/device 资源绑定令牌可访问 REST 与 MCP",
  async ({ isolatedWorker, page, request }, testInfo) => {
    const clientName = `device-e2e-resource-token-${Date.now()}`;
    const restResource = `${isolatedWorker.origin}/api/auth`;
    const mcpResource = `${isolatedWorker.origin}/api/mcp`;
    const resources = [restResource, mcpResource];
    const result = await requestDeviceCode(
      isolatedWorker,
      request,
      clientName,
      {
        clientScopes: DEVICE_MCP_CLIENT_SCOPES,
        resources,
        scope: DEVICE_MCP_CLIENT_SCOPES.join(" "),
      },
    );
    await approveDeviceCode(isolatedWorker, page, result, {
      screenshot: { label: "resource-approval", testInfo },
      visibleResources: resources,
    });
    const { accessToken, refreshToken } = await exchangeDeviceToken(
      request,
      result,
      resources,
    );
    expect(accessToken.split(".")).toHaveLength(3);
    expect(refreshToken).toEqual(expect.any(String));
    const todosResponse = await request.get("/api/workspace/todos", {
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
  },
);
isolatedTest(
  "/oauth/device 仅 profile 的 REST 令牌被受保护 REST 拒绝",
  async ({ isolatedWorker, page, request }) => {
    const clientName = `device-e2e-profile-rest-token-${Date.now()}`;
    const restResource = `${isolatedWorker.origin}/api/auth`;
    const scopes = ["openid", "profile"];
    const result = await requestDeviceCode(
      isolatedWorker,
      request,
      clientName,
      {
        clientScopes: scopes,
        resources: [restResource],
        scope: scopes.join(" "),
      },
    );
    await approveDeviceCode(isolatedWorker, page, result, {
      visibleResources: [restResource],
    });
    const { accessToken } = await exchangeDeviceToken(request, result, [
      restResource,
    ]);
    expect(accessToken.split(".")).toHaveLength(3);
    const todosResponse = await request.get("/api/workspace/todos", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    expect(todosResponse.status()).toBe(401);
    await expect(todosResponse.json()).resolves.toEqual({
      error: "Unauthorized",
    });
  },
);
isolatedTest(
  "/oauth/device 含其他 feature scope 但无 todo scope 的令牌被 todo REST 拒绝",
  async ({ isolatedWorker, page, request }) => {
    const clientName = `device-e2e-feature-rest-token-${Date.now()}`;
    const restResource = `${isolatedWorker.origin}/api/auth`;
    const scopes = ["openid", "profile", restReadScope("workspace.schedule")];
    const resources = [restResource];
    const result = await requestDeviceCode(
      isolatedWorker,
      request,
      clientName,
      {
        clientScopes: scopes,
        resources,
        scope: scopes.join(" "),
      },
    );
    await approveDeviceCode(isolatedWorker, page, result, {
      visibleResources: resources,
    });
    const { accessToken } = await exchangeDeviceToken(
      request,
      result,
      resources,
    );
    expect(accessToken.split(".")).toHaveLength(3);
    const todosResponse = await request.get("/api/workspace/todos", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    expect(todosResponse.status()).toBe(401);
    await expect(todosResponse.json()).resolves.toEqual({
      error: "Unauthorized",
    });
  },
);
isolatedTest(
  "/oauth/device 已禁用客户端代码显示错误而非批准界面",
  async ({ isolatedWorker, page, request }, testInfo) => {
    const clientName = `device-e2e-disabled-${Date.now()}`;
    const result = await requestDeviceCode(isolatedWorker, request, clientName);
    const verificationPath = getVerificationPath(
      result.verificationUriComplete,
    );
    await isolatedWorker.database.owner.oAuthClient.update({
      where: { clientId: result.clientId },
      data: { disabled: true },
    });
    await gotoAndWaitForReady(page, verificationPath, {
      expectMainContent: false,
    });
    await expect(page).not.toHaveURL(/\/account\/sign-in(?:\?.*)?$/);
    await expect(
      page.getByText(/invalid or has expired|无效|已过期/i).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /允许|Allow|批准|Approve/i }),
    ).toHaveCount(0);
    await captureStepScreenshot(page, testInfo, "oauth/device/disabled-client");
  },
);
isolatedTest(
  "/oauth/device 拒绝请求后不能兑换令牌",
  async ({ isolatedWorker, page, request }) => {
    const resource = `${isolatedWorker.origin}/api/auth`;
    const result = await requestDeviceCode(
      isolatedWorker,
      request,
      "Denied device",
      {
        resources: [resource],
      },
    );
    const actor = await isolatedWorker.createActor();
    await page.context().addCookies([actor.cookie]);
    await gotoAndWaitForReady(
      page,
      getVerificationPath(result.verificationUriComplete),
    );
    await page.getByRole("button", { name: /拒绝|Deny/i }).click();
    await expect(page).toHaveURL(/\/oauth\/device\?result=denied/);
    await expect(
      page.getByRole("heading", { name: /已拒绝|denied/i }),
    ).toBeVisible();
    const db = isolatedWorker.database.owner;
    const denied = await db.deviceCode.findUniqueOrThrow({
      where: { deviceCode: result.deviceCode },
    });
    expect(denied).toMatchObject({ status: "denied", userId: null });
    const pollStartedAt = Date.now();
    const response = await request.post("/api/auth/oauth2/token", {
      form: {
        grant_type: OAUTH_DEVICE_CODE_GRANT_TYPE,
        client_id: result.clientId,
        device_code: result.deviceCode,
        resource,
      },
    });
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: "access_denied" });
    const polled = await db.deviceCode.findUniqueOrThrow({
      where: { deviceCode: result.deviceCode },
    });
    // Rejected polling still advances its throttle timestamp; authorization
    // state and credentials must not change.
    expect(polled).toEqual({ ...denied, lastPolledAt: expect.any(Date) });
    expect(polled.lastPolledAt?.getTime()).toBeGreaterThanOrEqual(
      pollStartedAt,
    );
    expect(polled.lastPolledAt?.getTime()).toBeLessThanOrEqual(Date.now());
    expect(await db.oAuthAccessToken.count()).toBe(0);
    expect(await db.oAuthRefreshToken.count()).toBe(0);
    expect(await db.oAuthConsent.count()).toBe(0);
  },
);

isolatedTest(
  "/oauth/device 过期代码公开报错且不能兑换令牌",
  async ({ isolatedWorker, page, request }) => {
    const resource = `${isolatedWorker.origin}/api/auth`;
    const result = await requestDeviceCode(
      isolatedWorker,
      request,
      "Expired device",
      {
        resources: [resource],
      },
    );
    const db = isolatedWorker.database.owner;
    const expired = await db.deviceCode.update({
      where: { deviceCode: result.deviceCode },
      data: { expiresAt: new Date(0) },
    });
    await gotoAndWaitForReady(
      page,
      getVerificationPath(result.verificationUriComplete),
    );
    await expect(
      page.getByRole("heading", { name: /过期|expired/i }),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/\/account\/sign-in(?:\?.*)?$/);
    await expect(
      page.getByRole("button", { name: /允许|Allow|批准|Approve|拒绝|Deny/i }),
    ).toHaveCount(0);
    const response = await request.post("/api/auth/oauth2/token", {
      form: {
        grant_type: OAUTH_DEVICE_CODE_GRANT_TYPE,
        client_id: result.clientId,
        device_code: result.deviceCode,
        resource,
      },
    });
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: "expired_token" });
    expect(
      await db.deviceCode.findUniqueOrThrow({
        where: { deviceCode: result.deviceCode },
      }),
    ).toEqual(expired);
    expect(await db.oAuthAccessToken.count()).toBe(0);
    expect(await db.oAuthRefreshToken.count()).toBe(0);
    expect(await db.oAuthConsent.count()).toBe(0);
  },
);

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
test("页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/oauth/device", testInfo });
});
