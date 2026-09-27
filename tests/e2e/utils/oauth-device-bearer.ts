import { type APIRequestContext, expect } from "@playwright/test";
import { OAUTH_DEVICE_CODE_GRANT_TYPE } from "@/lib/oauth/constants";
import { PLAYWRIGHT_BASE_URL } from "./e2e-db";

export async function authorizeDeviceBearer(
  request: APIRequestContext,
  clientId: string,
  scope: string,
  resourcePath: "/api/auth" | "/api/graphql" | "/api/mcp" = "/api/auth",
) {
  const resource = `${PLAYWRIGHT_BASE_URL}${resourcePath}`;
  const response = await request.post("/api/auth/oauth2/device-authorization", {
    form: {
      client_id: clientId,
      scope,
      resource,
    },
    headers: { origin: PLAYWRIGHT_BASE_URL },
  });
  expect(response.status(), await response.text()).toBe(200);
  const code = await response.json();
  const approval = await request.post("/oauth/device?/approve", {
    form: { userCode: code.user_code },
    headers: { origin: PLAYWRIGHT_BASE_URL, accept: "text/html" },
    maxRedirects: 0,
  });
  expect(approval.status(), await approval.text()).toBe(303);
  expect(approval.headers().location).toContain("result=approved");
  const exchange = await request.post("/api/auth/oauth2/token", {
    form: {
      grant_type: OAUTH_DEVICE_CODE_GRANT_TYPE,
      client_id: clientId,
      device_code: code.device_code,
      resource,
    },
  });
  expect(exchange.status(), await exchange.text()).toBe(200);
  const { access_token: token } = await exchange.json();
  expect(typeof token).toBe("string");
  return token as string;
}
