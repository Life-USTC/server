import { createHash } from "node:crypto";
import { expect } from "@playwright/test";
import { decodeJwt } from "jose";
import { type OAuthState, test as oauthTest } from "./_fixture";

const clientId = "resource-binding-client";
const redirectUri = "https://resource-binding.example/callback";
const verifier = "v".repeat(64);
const scopes = ["openid", "offline_access", "workspace.todo:read"];
const hash = (value: string) =>
  createHash("sha256").update(value).digest("base64url");

function resourcePolicies(db: OAuthState["db"]) {
  return db.oauthResource.findMany({
    select: {
      identifier: true,
      allowedScopes: true,
      disabled: true,
      dpopBoundAccessTokensRequired: true,
    },
    orderBy: { identifier: "asc" },
  });
}

async function prepareResourceBinding({
  db,
  userId,
  origin,
  session,
  request,
}: OAuthState) {
  const mcp = `${origin}/api/mcp`;
  const graphql = `${origin}/api/graphql`;
  await db.oAuthClient.create({
    data: {
      clientId,
      name: "Resource binding contract",
      public: true,
      requirePKCE: true,
      redirectUris: [redirectUri],
      grantTypes: ["authorization_code", "refresh_token"],
      responseTypes: ["code"],
      scopes: ["openid", "profile", "offline_access", "workspace.todo:read"],
      tokenEndpointAuthMethod: "none",
    },
  });
  const metadata = await request.get(
    "/api/auth/.well-known/openid-configuration",
  );
  try {
    expect(metadata.status(), await metadata.text()).toBe(200);
    expect((await metadata.json()).issuer).toBe(`${origin}/api/auth`);
  } finally {
    await metadata.dispose();
  }
  const policies = await resourcePolicies(db);
  const sibling = new URL(origin);
  sibling.hostname = "127.0.0.1";
  expect(policies.map((policy) => policy.identifier)).toEqual(
    [origin, sibling.origin]
      .flatMap((host) =>
        ["/api/auth", "/api/mcp", "/api/graphql"].map(
          (path) => `${host}${path}`,
        ),
      )
      .sort(),
  );
  for (const policy of policies) {
    expect(policy).toMatchObject({
      disabled: false,
      dpopBoundAccessTokensRequired: false,
      allowedScopes: expect.arrayContaining(scopes),
    });
  }

  async function authorize(resource: string) {
    const state = crypto.randomUUID();
    const query = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(" "),
      state,
      prompt: "consent",
      code_challenge: hash(verifier),
      code_challenge_method: "S256",
      resource,
    });
    const provider = await session.get(`/api/auth/oauth2/authorize?${query}`, {
      maxRedirects: 0,
    });
    let signed: URLSearchParams;
    try {
      expect(provider.status(), await provider.text()).toBe(302);
      const location = new URL(provider.headers().location, origin);
      expect(location.origin).toBe(origin);
      expect(location.pathname).toBe("/oauth/authorize");
      signed = location.searchParams;
      expect(signed.getAll("ba_param").length).toBeGreaterThan(0);
      expect(signed.get("resource")).toBe(resource);
    } finally {
      await provider.dispose();
    }
    const approval = await session.post("/oauth/authorize?/consent", {
      form: {
        accept: "true",
        scope: scopes.join(" "),
        oauthQuery: signed.toString(),
      },
      headers: { origin, accept: "text/html" },
      maxRedirects: 0,
    });
    try {
      expect(approval.status(), await approval.text()).toBe(303);
      const callback = new URL(approval.headers().location, origin);
      expect(callback.origin + callback.pathname).toBe(redirectUri);
      expect(callback.searchParams.get("state")).toBe(state);
      const code = callback.searchParams.get("code");
      expect(code).toBeTruthy();
      if (!code) throw new Error("Expected actual provider authorization code");
      return code;
    } finally {
      await approval.dispose();
    }
  }
  async function token(params: Record<string, string>) {
    const response = await request.post("/api/auth/oauth2/token", {
      form: { client_id: clientId, ...params },
    });
    try {
      return { status: response.status(), body: await response.json() };
    } finally {
      await response.dispose();
    }
  }
  const exchange = (code: string, resource: string) =>
    token({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      resource,
    });
  async function consent() {
    const grant = await db.oAuthConsent.findUniqueOrThrow({
      where: { clientId_userId: { clientId, userId } },
    });
    expect(grant.resources).toEqual([mcp]);
    expect([...grant.scopes].sort()).toEqual([...scopes].sort());
    return grant;
  }
  function expectAccess(accessToken: string, grantId: string) {
    expect(typeof accessToken).toBe("string");
    expect(decodeJwt(accessToken)).toMatchObject({
      iss: `${origin}/api/auth`,
      sub: userId,
      azp: clientId,
      aud: [mcp, `${origin}/api/auth/oauth2/userinfo`],
      scope: scopes.join(" "),
      "urn:life-ustc:oauth:grant-id": grantId,
    });
  }
  async function storedRefresh(raw: string, grantId: string) {
    const stored = await db.oAuthRefreshToken.findUniqueOrThrow({
      where: { token: hash(raw) },
    });
    expect(stored).toMatchObject({
      clientId,
      userId,
      referenceId: grantId,
      resources: [mcp],
    });
    expect([...stored.scopes].sort()).toEqual([...scopes].sort());
    return stored;
  }
  return {
    db,
    userId,
    origin,
    mcp,
    graphql,
    policies,
    authorize,
    token,
    exchange,
    consent,
    expectAccess,
    storedRefresh,
  };
}

const test = oauthTest.extend<{
  binding: Awaited<ReturnType<typeof prepareResourceBinding>>;
}>({
  binding: async ({ oauth, run }, use) => {
    await use(await run(() => prepareResourceBinding(oauth)));
  },
});

test("oauth.authorization-code-resource-binding", async ({ binding, run }) =>
  run(async () => {
    const {
      db,
      mcp,
      graphql,
      policies,
      authorize,
      exchange,
      consent,
      expectAccess,
      storedRefresh,
    } = binding;
    for (const requestedResource of [mcp, graphql]) {
      const code = await authorize(mcp);
      const row = await db.verificationToken.findFirstOrThrow({
        where: { identifier: hash(code) },
      });
      expect(JSON.parse(row.token).query.resource).toBe(mcp);
      const grant = await consent();
      const beforeRefresh = await db.oAuthRefreshToken.findMany({
        orderBy: { id: "asc" },
      });
      const beforeAccess = await db.oAuthAccessToken.findMany({
        orderBy: { id: "asc" },
      });
      const response = await exchange(code, requestedResource);
      const result = response.body;
      if (requestedResource === mcp) {
        expect(response.status, JSON.stringify(result)).toBe(200);
        expect(decodeJwt(result.access_token).aud).toEqual([
          mcp,
          new URL("/api/auth/oauth2/userinfo", mcp).toString(),
        ]);
        expect(typeof result.refresh_token).toBe("string");
        expectAccess(result.access_token, grant.grantId);
        await storedRefresh(result.refresh_token, grant.grantId);
        expect(await db.oAuthRefreshToken.count()).toBe(
          beforeRefresh.length + 1,
        );
      } else {
        expect(response.status, JSON.stringify(result)).toBe(400);
        expect(result.error).toBe("invalid_target");
        expect(result.access_token).toBeUndefined();
        expect(result.refresh_token).toBeUndefined();
        expect(
          await db.oAuthRefreshToken.findMany({ orderBy: { id: "asc" } }),
        ).toEqual(beforeRefresh);
        expect(
          await db.oAuthAccessToken.findMany({ orderBy: { id: "asc" } }),
        ).toEqual(beforeAccess);
      }
    }
    expect(await resourcePolicies(db)).toEqual(policies);
  }));

test("oauth.rotated-refresh-replay", async ({ binding, run }) =>
  run(async () => {
    const {
      db,
      mcp,
      policies,
      authorize,
      exchange,
      token,
      consent,
      expectAccess,
      storedRefresh,
    } = binding;
    const code = await authorize(mcp);
    const grant = await consent();
    const issued = await exchange(code, mcp);
    const first = issued.body;
    expect(issued.status, JSON.stringify(first)).toBe(200);
    expect(typeof first.refresh_token).toBe("string");
    expectAccess(first.access_token, grant.grantId);
    const initial = await storedRefresh(first.refresh_token, grant.grantId);
    expect(await db.oAuthRefreshToken.count()).toBe(1);
    const rotated = await token({
      grant_type: "refresh_token",
      refresh_token: first.refresh_token,
      resource: mcp,
    });
    const replacement = rotated.body;
    expect(rotated.status, JSON.stringify(replacement)).toBe(200);
    expect(typeof replacement.refresh_token).toBe("string");
    expect(replacement.refresh_token).not.toBe(first.refresh_token);
    expectAccess(replacement.access_token, grant.grantId);
    const current = await storedRefresh(
      replacement.refresh_token,
      grant.grantId,
    );
    expect(current.id).not.toBe(initial.id);
    expect(current.revoked).toBeNull();
    expect(await db.oAuthRefreshToken.count()).toBe(2);
    const old = await storedRefresh(first.refresh_token, grant.grantId);
    expect(old.rotatedAt ?? old.revoked).not.toBeNull();
    expect(old.rotationReplayExpiresAt).not.toBeNull();
    expect(old.rotationReplayExpiresAt?.getTime()).toBeGreaterThan(Date.now());
    // Move the persisted retry window outside its allowed interval. The installed
    // provider tests rotationReplayExpiresAt, in addition to the rotation marker.
    const expired = new Date(Date.now() - 60_000);
    const aged = await db.oAuthRefreshToken.update({
      where: { id: old.id },
      data: {
        ...(old.rotatedAt ? { rotatedAt: expired } : {}),
        ...(old.revoked ? { revoked: expired } : {}),
        rotationReplayExpiresAt: expired,
      },
    });
    expect(aged.rotationReplayExpiresAt).toEqual(expired);
    const replay = await token({
      grant_type: "refresh_token",
      refresh_token: first.refresh_token,
      resource: mcp,
    });
    expect(replay.status).toBe(400);
    const failure = replay.body;
    expect(failure.error).toBe("invalid_grant");
    expect(failure).not.toHaveProperty("access_token");
    expect(failure).not.toHaveProperty("refresh_token");
    expect(failure.error_description).toBe(
      "The refresh token no longer has an active user grant.",
    );
    // The application's replay guard invalidates this generation and retains a
    // revoked marker so a racing replacement cannot revive the old lineage.
    const remaining = await db.oAuthRefreshToken.findMany();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({
      id: old.id,
      token: hash(first.refresh_token),
      clientId,
      userId: binding.userId,
      referenceId: grant.grantId,
      resources: [mcp],
      revoked: expired,
    });
    expect([...remaining[0].scopes].sort()).toEqual(
      [...scopes, "urn:life-ustc:oauth:refresh-replay-tombstone"].sort(),
    );
    expect(await db.oAuthRefreshToken.count({ where: { revoked: null } })).toBe(
      0,
    );
    expect(
      await db.oAuthRefreshToken.findUnique({ where: { id: current.id } }),
    ).toBeNull();
    expect(await db.oAuthAccessToken.count()).toBe(0);
    const invalidated = await consent();
    expect(invalidated.grantId).not.toBe(grant.grantId);
    expect(invalidated).toMatchObject({
      id: grant.id,
      clientId,
      userId: binding.userId,
      scopes: grant.scopes,
      resources: grant.resources,
    });
    expect(await resourcePolicies(db)).toEqual(policies);
  }));
