import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createAdminOAuthClientAction } from "@/features/admin/server/admin-oauth-create-action";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { getAdminUsersRoute } from "@/lib/api/routes/admin-users";
import { getTodosRoute } from "@/lib/api/routes/todos";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { resolveActiveOAuthUserGrant } from "@/lib/oauth/active-user-grant";
import { getCanonicalOAuthIssuer } from "@/lib/oauth/resource-urls";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const adminId = `client-admin-${marker}`;
const userId = `client-user-${marker}`;
const otherId = `client-other-${marker}`;
const origin = "http://localhost:3000";
const clients: string[] = [];
let cookie: string;
let userCookie: string;
let registrationAddress = 1;
async function session(id: string) {
  const token = crypto.randomUUID();
  await db.session.create({
    data: {
      userId: id,
      sessionToken: token,
      expires: new Date(Date.now() + 3600000),
    },
  });
  const context = await getBetterAuthInstance().$context;
  return `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`;
}
beforeAll(async () => {
  for (const id of [adminId, userId, otherId])
    await db.user.create({
      data: { id, email: `${id}@example.test`, isAdmin: id === adminId },
    });
  cookie = await session(adminId);
  userCookie = await session(userId);
});
afterAll(async () => {
  await db.oAuthClient.deleteMany({ where: { clientId: { in: clients } } });
  await db.auditLog.deleteMany({
    where: { userId: { in: [adminId, userId, otherId] } },
  });
  await db.user.deleteMany({
    where: { id: { in: [adminId, userId, otherId] } },
  });
  await db.$disconnect();
});
function createRequest(
  name: string,
  redirect: string,
  method = "none",
  sessionCookie = cookie,
  scope = "workspace.todo:read",
) {
  const form = new FormData();
  form.set("name", name);
  form.set("redirectUris", redirect);
  form.set("tokenEndpointAuthMethod", method);
  form.set("scopes", scope);
  return new Request(`${origin}/admin/oauth?/createClient`, {
    method: "POST",
    headers: { cookie: sessionCookie, origin },
    body: form,
  });
}
async function create(
  name: string,
  redirect: string,
  method = "none",
  sessionCookie = cookie,
  scope = "workspace.todo:read",
) {
  const result = await createAdminOAuthClientAction(
    createRequest(name, redirect, method, sessionCookie, scope),
    "en-us",
    marker,
  );
  if (!result) throw new Error("Expected client creation result");
  if ("createdClientId" in result) clients.push(result.createdClientId);
  return result;
}

it("oauth.client-validation-from-provider", async () => {
  for (const [redirect, allowed] of [
    ["https://client.example/callback", true],
    ["http://127.0.0.1:14567/callback", true],
    ["/relative", false],
    ["javascript:alert(1)", false],
    ["https://client.example/callback#fragment", false],
    ["https://user:password@client.example/callback", false],
  ] as const) {
    const name = `${marker}-${crypto.randomUUID()}`;
    const result = await create(name, redirect);
    const dcr = await getBetterAuthInstance().handler(
      new Request(`${origin}/api/auth/oauth2/register`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": `198.51.100.${registrationAddress++}`,
        },
        body: JSON.stringify({
          client_name: name,
          redirect_uris: [redirect],
          application_type: "native",
          token_endpoint_auth_method: "none",
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          scope: "workspace.todo:read",
        }),
      }),
    );
    const dcrBody = await dcr.json();
    if (typeof dcrBody.client_id === "string") clients.push(dcrBody.client_id);
    if (allowed) {
      expect(result).toMatchObject({
        createdClientName: name,
        createdClientRedirectUris: [redirect],
        createdClientSecret: null,
      });
      expect(dcr.status, JSON.stringify(dcrBody)).toBe(201);
      expect(await db.oAuthClient.count({ where: { name } })).toBe(2);
    } else {
      expect("status" in result && result.status).toBe(400);
      expect(dcr.status, JSON.stringify(dcrBody)).toBe(400);
      expect(await db.oAuthClient.count({ where: { name } })).toBe(0);
    }
  }
  for (const [name, method, scope] of [
    ["", "none", "workspace.todo:read"],
    [`${marker}-auth`, "unsupported", "workspace.todo:read"],
    [`${marker}-scope`, "none", "admin:all"],
  ]) {
    const result = await create(
      name,
      "https://client.example/callback",
      method,
      cookie,
      scope,
    );
    expect("status" in result && result.status).toBe(400);
    expect(await db.oAuthClient.count({ where: { name } })).toBe(0);
  }
});

it("oauth.trusted-clients-admin-backend", async () => {
  await expect(
    create(
      `${marker}-denied`,
      "https://client.example/callback",
      "client_secret_basic",
      userCookie,
    ),
  ).rejects.toMatchObject({ status: 403 });
  for (const method of ["none", "client_secret_post", "client_secret_basic"]) {
    const result = await create(
      `${marker}-trusted-brand`,
      "https://life.ustc.edu.cn/callback",
      method,
    );
    if (!("createdClientId" in result)) throw new Error(JSON.stringify(result));
    const clientId = result.createdClientId;
    const stored = await db.oAuthClient.findUniqueOrThrow({
      where: { clientId },
    });
    expect(stored.skipConsent).toBe(method === "client_secret_basic");
    const grant = await resolveActiveOAuthUserGrant({ clientId, userId });
    if (method !== "client_secret_basic") {
      expect(grant).toBeNull();
      // Spoofing registration provenance, brand, or upstream identity cannot set trust.
      await db.oAuthClient.update({
        where: { clientId },
        data: {
          clientDiscoveryId: "cimd",
          metadata: {
            source: "admin_panel_svelte",
            trusted: true,
            issuer: origin,
          },
        },
      });
      expect(
        await resolveActiveOAuthUserGrant({ clientId, userId }),
      ).toBeNull();
      continue;
    }
    expect(grant).toEqual({ kind: "trusted" });
    const owned = await db.todo.create({
      data: { userId, title: `${marker}-owned` },
    });
    const foreign = await db.todo.create({
      data: { userId: otherId, title: `${marker}-foreign` },
    });
    const token = await signResourceBoundOAuthAccessToken({
      clientId,
      userId,
      scopes: ["workspace.todo:read"],
      resources: [getCanonicalOAuthIssuer()],
      issuedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 600,
    });
    if (!token) throw new Error("Expected signed trusted-client token");
    const headers = { authorization: `Bearer ${token}` };
    const response = await getTodosRoute(
      new Request(`${origin}/api/workspace/todos`, { headers }),
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain(owned.id);
    expect(body).not.toContain(foreign.id);
    expect(
      (
        await getAdminUsersRoute(
          new Request(`${origin}/api/admin/users`, { headers }),
        )
      ).status,
    ).toBe(401);
    expect(
      await db.user.findUniqueOrThrow({ where: { id: userId } }),
    ).toMatchObject({ isAdmin: false });
    await db.oAuthClient.update({
      where: { clientId },
      data: { skipConsent: false },
    });
    expect(await resolveActiveOAuthUserGrant({ clientId, userId })).toBeNull();
  }
});

it("audit.action-admin-oauth-client-create", async () => {
  const name = `private-client-name-${marker}`;
  const redirect = `https://private-client.example/${marker}`;
  const result = await create(name, redirect, "client_secret_basic");
  if (!("createdClientId" in result)) throw new Error(JSON.stringify(result));
  expect(typeof result.createdClientSecret).toBe("string");
  const stored = await db.oAuthClient.findUniqueOrThrow({
    where: { clientId: result.createdClientId },
  });
  expect(stored.redirectUris).toEqual([redirect]);
  const events = await db.auditLog.findMany({
    where: {
      action: "admin_oauth_client_create",
      targetId: result.createdClientId,
    },
  });
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    userId: adminId,
    targetId: result.createdClientId,
    targetType: "oauth_client",
    channel: "web",
    outcome: "success",
    metadata: {
      changedFields: [
        "redirectUris",
        "scopes",
        "tokenEndpointAuthMethod",
        "trusted",
      ],
    },
  });
  for (const privateValue of [name, redirect, result.createdClientSecret])
    if (privateValue)
      expect(JSON.stringify(events)).not.toContain(privateValue);
});

it("audit.action-admin-oauth-client-delete", async () => {
  const { deleteAdminOAuthClientAction } = await import(
    "@/features/admin/server/admin-oauth-delete-action"
  );
  const created = await create(
    `delete-${marker}`,
    "https://private-client.example/deleted",
    "client_secret_basic",
  );
  if (!("createdClientId" in created)) throw new Error(JSON.stringify(created));
  const form = new FormData();
  form.set("clientId", created.createdClientId);
  const confirmedRequest = () =>
    new Request(`${origin}/admin/oauth?/deleteClient`, {
      method: "POST",
      headers: { cookie, origin },
      body: form,
    });
  expect(
    await deleteAdminOAuthClientAction(confirmedRequest(), "en-us", marker),
  ).toMatchObject({ variant: "default" });
  expect(
    await db.oAuthClient.findUnique({
      where: { clientId: created.createdClientId },
    }),
  ).toBeNull();
  const rows = await db.auditLog.findMany({
    where: {
      action: "admin_oauth_client_delete",
      targetId: created.createdClientId,
    },
  });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    userId: adminId,
    channel: "web",
    targetType: "oauth_client",
    metadata: null,
    outcome: "success",
  });
  expect(
    await deleteAdminOAuthClientAction(confirmedRequest(), "en-us", marker),
  ).toMatchObject({ status: 404 });
  expect(
    await db.auditLog.findMany({
      where: {
        action: "admin_oauth_client_delete",
        targetId: created.createdClientId,
      },
    }),
  ).toEqual(rows);
  if (created.createdClientSecret)
    expect(JSON.stringify(rows)).not.toContain(created.createdClientSecret);
});
