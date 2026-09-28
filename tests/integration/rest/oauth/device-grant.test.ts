import { expect } from "@playwright/test";
import { verifyAccessTokenJwt } from "@/lib/auth/jwt-verification";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";
import { type OAuthState, test as oauthTest } from "./_fixture";

const grantType = "urn:ietf:params:oauth:grant-type:device_code";
const scopes = ["offline_access", "workspace.todo:read"];
const clientId = "device-client";
function deviceHelpers({ db, userId, origin, request, session }: OAuthState) {
  async function authorize(resource: string, proof = false) {
    const response = await request.post(
      "/api/auth/oauth2/device-authorization",
      {
        headers: proof ? { DPoP: "unsupported-proof" } : {},
        form: { client_id: clientId, scope: scopes.join(" "), resource },
      },
    );
    return { response, body: await response.json() };
  }
  async function exchange(
    deviceCode: string,
    resource?: string,
    proof = false,
  ) {
    const response = await request.post("/api/auth/oauth2/token", {
      headers: proof ? { DPoP: "unsupported-proof" } : {},
      form: {
        client_id: clientId,
        device_code: deviceCode,
        grant_type: grantType,
        ...(resource ? { resource } : {}),
      },
    });
    return { response, body: await response.json() };
  }
  async function decide(userCode: string, decision: "approve" | "deny") {
    const response = await session.post(`/oauth/device?/${decision}`, {
      form: { userCode },
      headers: { origin, accept: "text/html" },
      maxRedirects: 0,
    });
    expect(response.status(), await response.text()).toBe(303);
    expect(response.headers().location).toBe(
      `/oauth/device?result=${decision === "approve" ? "approved" : "denied"}`,
    );
  }
  return { db, userId, origin, authorize, exchange, decide };
}
const test = oauthTest.extend<{ device: ReturnType<typeof deviceHelpers> }>({
  device: async ({ oauth }, use) => {
    await oauth.db.oAuthClient.create({
      data: {
        clientId,
        name: "Device authorization contract",
        tokenEndpointAuthMethod: "none",
        grantTypes: [grantType],
        scopes,
      },
    });
    await use(deviceHelpers(oauth));
  },
});

function resources(origin: string) {
  return [`${origin}/api/auth`, `${origin}/api/graphql`, `${origin}/api/mcp`];
}

test.describe("oauth.device-grant-custom", () => {
  for (const [name, patch] of Object.entries({
    "disabled client": { disabled: true },
    "confidential client": { tokenEndpointAuthMethod: "client_secret_basic" },
    "unregistered device grant": { grantTypes: ["authorization_code"] },
    "DPoP-bound client": { dpopBoundAccessTokens: true },
  })) {
    test(`rejects ${name} without creating a device code`, async ({
      device,
    }) => {
      const { db, origin, authorize } = device;
      await db.oAuthClient.update({ where: { clientId }, data: patch });
      const rejected = await authorize(resources(origin)[0]);
      expect(rejected.response.status(), JSON.stringify(patch)).toBe(400);
      expect(rejected.body.device_code).toBeUndefined();
      expect(await db.deviceCode.count({ where: { clientId } })).toBe(0);
    });
  }
  test("rejects DPoP proof without creating a device code", async ({
    device,
  }) => {
    const { db, origin, authorize } = device;
    const proof = await authorize(resources(origin)[0], true);
    expect(proof.response.status()).toBe(400);
    expect(proof.body.error).toBe("invalid_dpop_proof");
    expect(await db.deviceCode.count({ where: { clientId } })).toBe(0);
  });
  for (const index of [0, 1, 2]) {
    test(`approves and consumes a grant bound to ${["REST", "GraphQL", "MCP"][index]}`, async ({
      device,
    }) => {
      const { db, userId, origin, authorize, exchange, decide } = device;
      const allResources = resources(origin);
      const resource = allResources[index];
      const authorization = await authorize(resource);
      expect(
        authorization.response.status(),
        JSON.stringify(authorization.body),
      ).toBe(200);
      const code = authorization.body.device_code;
      expect(authorization.body.verification_uri_complete).toContain(
        authorization.body.user_code,
      );
      expect(
        await db.deviceCode.findUniqueOrThrow({ where: { deviceCode: code } }),
      ).toMatchObject({
        clientId,
        resources: [resource],
        scopes,
        status: "pending",
        userId: null,
      });
      const pending = await exchange(code);
      expect(pending.body.error).toBe("authorization_pending");
      await decide(authorization.body.user_code, "approve");
      await db.deviceCode.update({
        where: { deviceCode: code },
        data: { lastPolledAt: null },
      });
      const rejectedProof = await exchange(code, resource, true);
      expect(rejectedProof.body.error).toBe("invalid_dpop_proof");
      const mismatch = await exchange(
        code,
        allResources.find((value) => value !== resource),
      );
      expect(mismatch.body.error).toBe("invalid_target");
      expect(mismatch.body.access_token).toBeUndefined();
      await db.deviceCode.update({
        where: { deviceCode: code },
        data: { lastPolledAt: null },
      });
      const issued = await exchange(code, resource);
      expect(issued.response.status(), JSON.stringify(issued.body)).toBe(200);
      expect(issued.body).toMatchObject({
        token_type: "Bearer",
        scope: scopes.join(" "),
      });
      const options = {
        issuer: `${origin}/api/auth`,
        audience: resource,
        jwksUrl: `${origin}/api/auth/jwks`,
      };
      const verified = await verifyAccessTokenJwt(
        issued.body.access_token,
        options,
      );
      expect(verified).toMatchObject({
        sub: userId,
        clientId,
        aud: resource,
        tokenScopes: scopes,
      });
      for (const otherResource of allResources.filter(
        (value) => value !== resource,
      )) {
        await expect(
          verifyAccessTokenJwt(issued.body.access_token, {
            ...options,
            audience: otherResource,
          }),
        ).rejects.toThrow();
      }
      expect(
        await db.oAuthConsent.findUniqueOrThrow({
          where: { clientId_userId: { clientId, userId } },
        }),
      ).toMatchObject({
        scopes,
        resources: [resource],
        grantId: verified.grantId,
      });
      expect(
        await db.oAuthRefreshToken.findUniqueOrThrow({
          where: {
            token: await hashOAuthClientSecretForDbStorage(
              issued.body.refresh_token,
            ),
          },
        }),
      ).toMatchObject({
        clientId,
        userId,
        scopes,
        resources: [resource],
        grantId: verified.grantId,
      });
      expect(
        await db.deviceCode.findUnique({ where: { deviceCode: code } }),
      ).toBeNull();
      const replay = await exchange(code);
      expect(replay.body.error).toBe("invalid_grant");
      expect(replay.body.access_token).toBeUndefined();
    });
  }
  for (const state of ["denied", "expired", "disabled"] as const) {
    test(`rejects ${state} device grants`, async ({ device }) => {
      const { db, origin, authorize, exchange, decide } = device;
      const resources = [`${origin}/api/auth`];
      const authorization = await authorize(resources[0]);
      const code = authorization.body.device_code;
      if (state === "denied")
        await decide(authorization.body.user_code, "deny");
      else {
        await decide(authorization.body.user_code, "approve");
        if (state === "expired")
          await db.deviceCode.update({
            where: { deviceCode: code },
            data: { expiresAt: new Date(0) },
          });
        else
          await db.oAuthClient.update({
            where: { clientId },
            data: { disabled: true },
          });
      }
      const rejected = await exchange(code);
      expect(rejected.body.error).toBe(
        {
          denied: "access_denied",
          expired: "expired_token",
          disabled: "invalid_client",
        }[state],
      );
      expect(rejected.body.access_token).toBeUndefined();
    });
  }
});
