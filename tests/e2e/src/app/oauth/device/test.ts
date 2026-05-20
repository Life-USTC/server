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
 * - /oauth/device page renders user code entry form
 * - Unauthenticated verification link → redirect to /signin
 * - After login → approval/denial screen
 *
 * ## Edge Cases
 * - Invalid user code → shows error
 * - Expired user code → shows error
 */
import { type APIRequestContext, expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

type DeviceAuthorizationResult = {
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
};

async function registerDeviceClient(request: APIRequestContext) {
  const registerResponse = await request.post("/api/auth/oauth2/register", {
    data: {
      client_name: `device-e2e-${Date.now()}`,
      redirect_uris: [`${PLAYWRIGHT_BASE_URL}/e2e/device/callback`],
      token_endpoint_auth_method: "none",
      // The DCR endpoint currently accepts the standard public-client grant
      // registration shape used elsewhere in E2E. The device-authorization
      // route itself is what we are exercising here.
      grant_types: ["authorization_code"],
      response_types: ["code"],
      scope: "openid profile",
    },
  });
  expect(registerResponse.status()).toBe(200);
  const registerBody = (await registerResponse.json()) as {
    client_id?: string;
  };
  expect(typeof registerBody.client_id).toBe("string");
  return registerBody.client_id as string;
}

function getVerificationPath(verificationUriComplete: string) {
  const url = new URL(verificationUriComplete);
  return `${url.pathname}${url.search}`;
}

async function requestDeviceCode(
  request: APIRequestContext,
): Promise<DeviceAuthorizationResult> {
  const clientId = await registerDeviceClient(request);
  const deviceResponse = await request.post(
    "/api/auth/oauth2/device-authorization",
    {
      form: {
        client_id: clientId,
        scope: "openid profile",
      },
    },
  );
  expect(deviceResponse.status()).toBe(200);

  const deviceBody = (await deviceResponse.json()) as {
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
    userCode: deviceBody.user_code as string,
    verificationUri: deviceBody.verification_uri as string,
    verificationUriComplete: deviceBody.verification_uri_complete as string,
    expiresIn: deviceBody.expires_in as number,
    interval: deviceBody.interval as number,
  };
}

test("/oauth/device page renders user code entry form", async ({
  page,
}, testInfo) => {
  await signInAsDebugUser(page, "/oauth/device");

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

test("/oauth/device device-authorization endpoint returns required fields", async ({
  request,
}) => {
  const result = await requestDeviceCode(request);
  const verificationUrl = new URL(result.verificationUriComplete);

  expect(result.verificationUri).toBe(`${PLAYWRIGHT_BASE_URL}/oauth/device`);
  expect(verificationUrl.origin).toBe(PLAYWRIGHT_BASE_URL);
  expect(verificationUrl.pathname).toBe("/oauth/device");
  expect(verificationUrl.searchParams.get("code")).toBe(result.userCode);
  expect(verificationUrl.searchParams.get("step")).toBe("approve");
  expect(result.expiresIn).toBeGreaterThan(0);
  expect(result.interval).toBeGreaterThan(0);
});

test("/oauth/device rejects scopes outside the registered client allowance", async ({
  request,
}) => {
  const clientId = await registerDeviceClient(request);
  const response = await request.post("/api/auth/oauth2/device-authorization", {
    form: {
      client_id: clientId,
      scope: "openid profile unsupported:e2e-scope",
    },
  });

  expect(response.status()).toBe(400);
  expect(await response.json()).toMatchObject({
    error: "invalid_scope",
    error_description: "Requested scope is not allowed for this client",
  });
});

test("/oauth/device unauthenticated verification link redirects to sign-in", async ({
  page,
  request,
}, testInfo) => {
  const result = await requestDeviceCode(request);
  const verificationPath = getVerificationPath(result.verificationUriComplete);

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
});

test("/oauth/device authenticated user sees approval screen", async ({
  page,
  request,
}, testInfo) => {
  const result = await requestDeviceCode(request);
  const verificationPath = getVerificationPath(result.verificationUriComplete);

  await signInAsDebugUser(page, verificationPath);

  await expect(
    page
      .getByRole("button", { name: /允许|Allow|批准|Approve/i })
      .or(page.getByRole("button", { name: /拒绝|Deny/i }))
      .first(),
  ).toBeVisible({ timeout: 15_000 });

  await captureStepScreenshot(page, testInfo, "oauth/device/approval-screen");
});

test("/oauth/device well-known discovery includes device endpoint", async ({
  request,
}) => {
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
