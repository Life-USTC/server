import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { completeDeviceCodeDecision } from "@/features/oauth/server/device-decision.server";
import { deviceAuthorizationPostRoute } from "@/lib/api/routes/auth-device-authorization";
import { tokenPostRoute } from "@/lib/api/routes/auth-token";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { verifyAccessTokenJwt } from "@/lib/auth/jwt-verification";
import {
  getCanonicalOAuthIssuer,
  getOAuthGraphqlResourceUrl,
  getOAuthMcpResourceUrl,
} from "@/lib/oauth/resource-urls";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const userId = `device-user-${marker}`;
const clientId = `device-client-${marker}`;
const origin = "http://localhost:3000";
const grantType = "urn:ietf:params:oauth:grant-type:device_code";
const scopes = ["offline_access", "workspace.todo:read"];
let cookie: string;

beforeAll(async () => {
  await db.user.create({
    data: { id: userId, email: `${userId}@example.test` },
  });
  const token = crypto.randomUUID();
  await db.session.create({
    data: {
      userId,
      sessionToken: token,
      expires: new Date(Date.now() + 3_600_000),
    },
  });
  const context = await getBetterAuthInstance().$context;
  cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`;
  await db.oAuthClient.create({
    data: {
      clientId,
      name: "Device authorization contract",
      tokenEndpointAuthMethod: "none",
      grantTypes: [grantType],
      scopes,
    },
  });
});
afterAll(async () => {
  await db.oAuthClient.deleteMany({ where: { clientId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
});
async function authorize(resource: string, proof = false) {
  const response = await deviceAuthorizationPostRoute(
    new Request(`${origin}/api/auth/device/code`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        ...(proof ? { DPoP: "unsupported-proof" } : {}),
      },
      body: new URLSearchParams({
        client_id: clientId,
        scope: scopes.join(" "),
        resource,
      }),
    }),
  );
  return { response, body: await response.json() };
}
async function exchange(deviceCode: string, resource?: string, proof = false) {
  const response = await tokenPostRoute(
    new Request(`${origin}/api/auth/oauth2/token`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        ...(proof ? { DPoP: "unsupported-proof" } : {}),
      },
      body: new URLSearchParams({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: grantType,
        ...(resource ? { resource } : {}),
      }),
    }),
  );
  return { response, body: await response.json() };
}
async function decide(userCode: string, decision: "approve" | "deny") {
  const form = new FormData();
  form.set("userCode", userCode);
  await expect(
    completeDeviceCodeDecision(
      new Request(`${origin}/oauth/device`, {
        method: "POST",
        headers: { cookie, origin },
        body: form,
      }),
      form,
      decision,
    ),
  ).rejects.toMatchObject({
    status: 303,
    location: `/oauth/device?result=${decision === "approve" ? "approved" : "denied"}`,
  });
}

it("oauth.device-grant-custom", { timeout: 30_000 }, async () => {
  const resources = [
    getCanonicalOAuthIssuer(),
    getOAuthGraphqlResourceUrl(),
    getOAuthMcpResourceUrl(),
  ];
  for (const patch of [
    { disabled: true },
    { tokenEndpointAuthMethod: "client_secret_basic" },
    { grantTypes: ["authorization_code"] },
    { dpopBoundAccessTokens: true },
  ]) {
    await db.oAuthClient.update({ where: { clientId }, data: patch });
    const rejected = await authorize(resources[0]);
    expect(rejected.response.status, JSON.stringify(patch)).toBe(400);
    expect(rejected.body.device_code).toBeUndefined();
    expect(await db.deviceCode.count({ where: { clientId } })).toBe(0);
    await db.oAuthClient.update({
      where: { clientId },
      data: {
        disabled: false,
        tokenEndpointAuthMethod: "none",
        grantTypes: [grantType],
        dpopBoundAccessTokens: false,
      },
    });
  }
  const proof = await authorize(resources[0], true);
  expect(proof.response.status).toBe(400);
  expect(proof.body.error).toBe("invalid_dpop_proof");
  expect(await db.deviceCode.count({ where: { clientId } })).toBe(0);
  for (const resource of resources) {
    const authorization = await authorize(resource);
    expect(
      authorization.response.status,
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
      resources.find((value) => value !== resource),
    );
    expect(mismatch.body.error).toBe("invalid_target");
    expect(mismatch.body.access_token).toBeUndefined();
    await db.deviceCode.update({
      where: { deviceCode: code },
      data: { lastPolledAt: null },
    });
    const issued = await exchange(code, resource);
    expect(issued.response.status, JSON.stringify(issued.body)).toBe(200);
    expect(issued.body).toMatchObject({
      token_type: "Bearer",
      scope: scopes.join(" "),
    });
    const options = {
      issuer: getCanonicalOAuthIssuer(),
      audience: resource,
      jwksUrl: `${origin}/api/auth/jwks`,
      jwksFetch: () => getBetterAuthInstance().api.getJwks({}),
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
    for (const otherResource of resources.filter(
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
  }
  for (const state of ["denied", "expired", "disabled"] as const) {
    const authorization = await authorize(resources[0]);
    const code = authorization.body.device_code;
    if (state === "denied") await decide(authorization.body.user_code, "deny");
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
  }
});
