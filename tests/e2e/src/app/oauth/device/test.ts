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
 *
 * ## Edge Cases
 * - Invalid user code → shows error
 * - Expired user code → shows error
 */
import { type APIRequestContext, expect, test } from "@playwright/test";
import {
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { signInAsDebugUser } from "../../../../utils/auth";
import {
  createOAuthClientFixture,
  deleteOAuthClientsByName,
  PLAYWRIGHT_BASE_URL,
} from "../../../../utils/e2e-db";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

type DeviceAuthorizationResult = {
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
};

async function registerDeviceClient(clientName: string) {
  const client = await createOAuthClientFixture({
    name: clientName,
    redirectUris: [`${PLAYWRIGHT_BASE_URL}/e2e/device/callback`],
    tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
    grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
    scopes: ["openid", "profile"],
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
): Promise<DeviceAuthorizationResult> {
  const clientId = await registerDeviceClient(clientName);
  const deviceResponse = await request.post(
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

test("/oauth/device invalid user code shows public error", async ({
  page,
}, testInfo) => {
  await gotoAndWaitForReady(page, "/oauth/device?code=NOPE-NOPE&step=approve");

  await expect(
    page.getByText(/未找到|not found|No device login request/i).first(),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/\/signin(?:\?.*)?$/);
  await captureStepScreenshot(page, testInfo, "oauth/device/invalid-code");
});

test("/oauth/device device-authorization endpoint returns required fields", async ({
  request,
}) => {
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

test("/oauth/device rejects scopes outside the registered client allowance", async ({
  request,
}) => {
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

test("/oauth/device unauthenticated pending approval redirects to sign-in", async ({
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

test("/oauth/device authenticated user sees approval screen", async ({
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
