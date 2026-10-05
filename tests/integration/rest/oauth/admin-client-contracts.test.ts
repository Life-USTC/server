import { type APIRequestContext, expect } from "@playwright/test";
import { symmetricDecrypt } from "better-auth/crypto";
import { parse } from "devalue";
import { importJWK, SignJWT } from "jose";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test as workerTest } from "../../../e2e/utils/owned-worker";

type CreatedClient = {
  createdClientId: string;
  createdClientName: string;
  createdClientRedirectUris: string[];
  createdClientSecret: string | null;
};

async function prepare(worker: IsolatedWorker, request: APIRequestContext) {
  const db = worker.database.owner;
  const origin = worker.origin;
  const marker = crypto.randomUUID();
  const metadata = await request.get(
    `${origin}/api/auth/.well-known/openid-configuration`,
  );
  try {
    expect(metadata.status()).toBe(200);
    expect((await metadata.json()).issuer).toBe(`${origin}/api/auth`);
  } finally {
    await metadata.dispose();
  }
  const sibling = new URL(origin);
  sibling.hostname = "127.0.0.1";
  const identifiers = await db.oauthResource.findMany({
    select: { identifier: true },
    orderBy: { identifier: "asc" },
  });
  expect(identifiers.map(({ identifier }) => identifier)).toEqual(
    [origin, sibling.origin]
      .flatMap((host) =>
        ["/api/auth", "/api/graphql", "/api/mcp"].map(
          (path) => `${host}${path}`,
        ),
      )
      .sort(),
  );

  const admin = await worker.createActor({ isAdmin: true });
  const account = await worker.createActor();
  const adminId = admin.id;
  const userId = account.id;
  const otherId = `client-other-${marker}`;
  await db.user.create({
    data: { id: otherId, email: `${otherId}@test.invalid` },
  });

  async function action(
    session: APIRequestContext,
    name: "createClient" | "deleteClient",
    form: Record<string, string>,
  ) {
    const response = await session.post(`/admin/oauth?/${name}`, {
      headers: {
        origin,
        accept: "application/json",
        "x-sveltekit-action": "true",
      },
      form,
      maxRedirects: 0,
    });
    try {
      const body = await response.json();
      expect(["success", "failure", "error"]).toContain(body.type);
      if (body.type === "error") {
        expect(response.status()).toBeGreaterThanOrEqual(400);
        expect(body.error).toBeDefined();
      } else {
        expect(response.status()).toBe(200);
        expect(typeof body.status).toBe("number");
        if (body.type === "success") expect(body.status).toBe(200);
        else expect(body.status).toBeGreaterThanOrEqual(400);
      }
      return {
        type: body.type as "success" | "failure" | "error",
        status:
          body.type === "error" ? response.status() : (body.status as number),
        data: typeof body.data === "string" ? parse(body.data) : undefined,
      };
    } finally {
      await response.dispose();
    }
  }
  async function create(
    name: string,
    redirect: string,
    method = "none",
    session = admin.request,
    scope = "workspace.todo:read",
  ): Promise<CreatedClient | { status: number }> {
    const result = await action(session, "createClient", {
      name,
      redirectUris: redirect,
      tokenEndpointAuthMethod: method,
      scopes: scope,
    });
    return result.type === "success" ? result.data : { status: result.status };
  }
  async function remove(clientId: string) {
    const result = await action(admin.request, "deleteClient", { clientId });
    return result.type === "success" ? result.data : { status: result.status };
  }
  async function registration(name: string, redirect: string) {
    const response = await request.post(`${origin}/api/auth/oauth2/register`, {
      data: {
        client_name: name,
        redirect_uris: [redirect],
        application_type: "native",
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: "workspace.todo:read",
      },
    });
    try {
      return { status: response.status(), body: await response.json() };
    } finally {
      await response.dispose();
    }
  }
  async function token(clientId: string) {
    // The private Worker provisions its real key. Token preparation does not
    // invoke a Node provider singleton or the authorization logic under test.
    const response = await request.get(`${origin}/api/auth/jwks`);
    let keys: { kid: string }[];
    try {
      expect(response.status()).toBe(200);
      keys = (await response.json()).keys;
    } finally {
      await response.dispose();
    }
    const key = await db.jwks.findFirstOrThrow({
      where: { id: { in: keys.map(({ kid }) => kid) } },
    });
    expect(key.alg).toBe("EdDSA");
    const privateJwk = await symmetricDecrypt({
      key: "e2e-dev-secret-not-for-production",
      data: JSON.parse(key.privateKey),
    });
    return new SignJWT({ azp: clientId, scope: "workspace.todo:read" })
      .setProtectedHeader({ alg: "EdDSA", kid: key.id, typ: "JWT" })
      .setSubject(userId)
      .setAudience(`${origin}/api/auth`)
      .setIssuer(`${origin}/api/auth`)
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(await importJWK(JSON.parse(privateJwk), "EdDSA"));
  }
  async function bearer(path: string, accessToken: string) {
    const response = await request.get(`${origin}${path}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      maxRedirects: 0,
    });
    try {
      return { status: response.status(), body: await response.text() };
    } finally {
      await response.dispose();
    }
  }
  return {
    db,
    origin,
    marker,
    adminId,
    userId,
    otherId,
    account,
    create,
    remove,
    registration,
    token,
    bearer,
  };
}

const test = workerTest.extend<{
  state: Awaited<ReturnType<typeof prepare>>;
}>({
  state: async ({ isolatedWorker, request, run }, use) => {
    await use(await run(() => prepare(isolatedWorker, request)));
  },
});

test(
  "oauth.client-validation-from-provider",
  { tag: "@OAuth/REST" },
  async ({ state, run }) =>
    run(async () => {
      const { db, marker, create, registration } = state;
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
        const dcr = await registration(name, redirect);
        const dcrBody = dcr.body;
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
          undefined,
          scope,
        );
        expect("status" in result && result.status).toBe(400);
        expect(await db.oAuthClient.count({ where: { name } })).toBe(0);
      }
    }),
);

test(
  "oauth.trusted-clients-admin-backend",
  { tag: "@OAuth/REST" },
  async ({ state, run }) =>
    run(async () => {
      const {
        db,
        marker,
        origin,
        userId,
        otherId,
        account,
        create,
        token,
        bearer,
      } = state;
      expect(
        await create(
          `${marker}-denied`,
          "https://client.example/callback",
          "client_secret_basic",
          account.request,
        ),
      ).toMatchObject({ status: 403 });
      expect(await db.oAuthClient.count()).toBe(0);
      expect(await db.auditLog.count()).toBe(0);
      const owned = await db.todo.create({
        data: { userId, title: `${marker}-owned` },
      });
      const foreign = await db.todo.create({
        data: { userId: otherId, title: `${marker}-foreign` },
      });
      for (const method of [
        "none",
        "client_secret_post",
        "client_secret_basic",
      ]) {
        const result = await create(
          `${marker}-trusted-brand`,
          "https://life.ustc.edu.cn/callback",
          method,
        );
        if (!("createdClientId" in result))
          throw new Error("Expected an administrator-created OAuth client");
        const clientId = result.createdClientId;
        const stored = await db.oAuthClient.findUniqueOrThrow({
          where: { clientId },
        });
        expect(stored.skipConsent).toBe(method === "client_secret_basic");
        expect(await db.oAuthConsent.count()).toBe(0);
        const accessToken = await token(clientId);
        const response = await bearer("/api/workspace/todos", accessToken);
        if (method !== "client_secret_basic") {
          expect(response.status).toBe(401);
          expect(response.body).not.toContain(owned.id);
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
          const spoofed = await bearer("/api/workspace/todos", accessToken);
          expect(spoofed.status).toBe(401);
          expect(spoofed.body).not.toContain(owned.id);
          continue;
        }
        expect(response.status).toBe(200);
        expect(response.body).toContain(owned.id);
        expect(response.body).not.toContain(foreign.id);
        expect((await bearer("/api/admin/users", accessToken)).status).toBe(
          401,
        );
        expect(
          await db.user.findUniqueOrThrow({ where: { id: userId } }),
        ).toMatchObject({ isAdmin: false });
        await db.oAuthClient.update({
          where: { clientId },
          data: { skipConsent: false },
        });
        const revoked = await bearer("/api/workspace/todos", accessToken);
        expect(revoked.status).toBe(401);
        expect(revoked.body).not.toContain(owned.id);
      }
      expect(await db.oAuthConsent.count()).toBe(0);
      expect(await db.jwks.count()).toBe(1);
    }),
);

test(
  "audit.action-admin-oauth-client-create",
  { tag: "@OAuth/REST" },
  async ({ state, run }) =>
    run(async () => {
      const { db, marker, adminId, create } = state;
      const name = `private-client-name-${marker}`;
      const redirect = `https://private-client.example/${marker}`;
      const result = await create(name, redirect, "client_secret_basic");
      if (!("createdClientId" in result))
        throw new Error("Expected an administrator-created OAuth client");
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
    }),
);

test(
  "audit.action-admin-oauth-client-delete",
  { tag: "@OAuth/REST" },
  async ({ state, run }) =>
    run(async () => {
      const { db, marker, adminId, create, remove } = state;
      const created = await create(
        `delete-${marker}`,
        "https://private-client.example/deleted",
        "client_secret_basic",
      );
      if (!("createdClientId" in created))
        throw new Error("Expected an administrator-created OAuth client");
      expect(await remove(created.createdClientId)).toMatchObject({
        variant: "default",
      });
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
      expect(await remove(created.createdClientId)).toMatchObject({
        status: 404,
      });
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
    }),
);
