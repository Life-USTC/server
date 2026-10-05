import { createHash } from "node:crypto";
import { expect } from "@playwright/test";
import { makeSignature } from "better-auth/crypto";
import { type OAuthState, test as oauthTest } from "./_fixture";

// Matches wrangler.e2e.jsonc. Only malformed negative cases are re-signed here;
// the accepted query must remain the real private provider endpoint output.
const signingSecret = "e2e-dev-secret-not-for-production";
const clientId = "consent-integrity-client";

function readResourcePolicies(db: OAuthState["db"]) {
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

async function prepareConsent({ db, userId, origin, session }: OAuthState) {
  await db.oAuthClient.create({
    data: {
      clientId,
      name: "Signed consent integrity",
      public: true,
      tokenEndpointAuthMethod: "none",
      requirePKCE: true,
      redirectUris: ["https://client.example/callback"],
      scopes: ["openid", "profile", "email"],
    },
  });

  // Initialize the actual Worker provider before observing its private policies.
  const metadata = await session.get(
    "/api/auth/.well-known/openid-configuration",
  );
  try {
    expect(metadata.status(), await metadata.text()).toBe(200);
    expect((await metadata.json()).issuer).toBe(`${origin}/api/auth`);
  } finally {
    await metadata.dispose();
  }
  const policies = await readResourcePolicies(db);
  const sibling = new URL(origin);
  sibling.hostname = "127.0.0.1";
  const expectedResources = [origin, sibling.origin].flatMap((host) =>
    ["/api/auth", "/api/mcp", "/api/graphql"].map((path) => `${host}${path}`),
  );
  expect(policies.map((policy) => policy.identifier)).toEqual(
    expectedResources.sort(),
  );
  for (const policy of policies) {
    expect(policy).toMatchObject({
      disabled: false,
      dpopBoundAccessTokensRequired: false,
      allowedScopes: expect.arrayContaining(["openid", "profile", "email"]),
    });
  }

  const authorize = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: "https://client.example/callback",
    scope: "openid profile email",
    state: crypto.randomUUID(),
    prompt: "consent",
    code_challenge: "a".repeat(43),
    code_challenge_method: "S256",
    claims: JSON.stringify({ userinfo: { name: null } }),
    resource: `${origin}/api/mcp`,
  });
  const provider = await session.get(
    `/api/auth/oauth2/authorize?${authorize}`,
    {
      maxRedirects: 0,
    },
  );
  let signed: URLSearchParams;
  try {
    expect(provider.status(), await provider.text()).toBe(302);
    const location = new URL(provider.headers().location, origin);
    expect(location.toString()).toContain("/oauth/authorize?");
    expect(location.origin).toBe(origin);
    signed = location.searchParams;
    expect(signed.getAll("ba_param").length).toBeGreaterThan(0);
  } finally {
    await provider.dispose();
  }

  // Calibrate the negative-case signer against the real provider signature so
  // malformed-name and expiry cases cannot pass merely because of a wrong key.
  const unsigned = new URLSearchParams(signed);
  unsigned.delete("sig");
  const canonical = new URLSearchParams(
    [...unsigned.entries()].sort(([ak, av], [bk, bv]) =>
      ak < bk ? -1 : ak > bk ? 1 : av < bv ? -1 : av > bv ? 1 : 0,
    ),
  );
  expect(
    (await makeSignature(canonical.toString(), signingSecret)) ===
      signed.get("sig"),
    "negative-case signer matches the private provider",
  ).toBe(true);

  async function submit(query: URLSearchParams, scope = "openid profile") {
    const response = await session.post("/oauth/authorize?/consent", {
      form: { accept: "true", oauthQuery: query.toString(), scope },
      headers: { origin, accept: "text/html" },
      maxRedirects: 0,
    });
    try {
      return {
        status: response.status(),
        location: response.headers().location,
      };
    } finally {
      await response.dispose();
    }
  }
  return { db, userId, origin, authorize, signed, policies, submit };
}

const test = oauthTest.extend<{
  consent: Awaited<ReturnType<typeof prepareConsent>>;
}>({
  consent: async ({ oauth, run }, use) => {
    await use(await run(() => prepareConsent(oauth)));
  },
});

test(
  "oauth.signed-consent-integrity",
  { tag: "@OAuth/OAuth" },
  async ({ consent: state, run }) =>
    run(async () => {
      const { db, userId, origin, authorize, signed, policies, submit } = state;
      for (const kind of [
        "legacy",
        "missing-name",
        "duplicate-name",
        "extra-name",
        "tampered-scope",
        "tampered-resource",
        "tampered-claims",
        "expired",
        "bad-signature",
      ] as const) {
        const query = new URLSearchParams(signed);
        query.delete("sig");
        if (kind === "legacy") query.delete("ba_param");
        if (kind === "missing-name") {
          const names = query
            .getAll("ba_param")
            .filter((name) => name !== "scope");
          query.delete("ba_param");
          for (const name of names) query.append("ba_param", name);
        }
        if (kind === "duplicate-name") query.append("ba_param", "scope");
        if (kind === "extra-name") query.append("ba_param", "undeclared");
        if (kind === "expired") query.set("exp", "1");
        const canonical = new URLSearchParams(
          [...query.entries()].sort(([ak, av], [bk, bv]) =>
            ak < bk ? -1 : ak > bk ? 1 : av < bv ? -1 : av > bv ? 1 : 0,
          ),
        );
        query.set(
          "sig",
          await makeSignature(
            kind === "legacy" ? query.toString() : canonical.toString(),
            signingSecret,
          ),
        );
        if (kind === "tampered-scope")
          query.set("scope", "profile email admin:write");
        if (kind === "tampered-resource")
          query.set("resource", `${origin}/api/graphql`);
        if (kind === "tampered-claims")
          query.set("claims", JSON.stringify({ userinfo: { email: null } }));
        if (kind === "bad-signature") query.set("sig", "invalid");
        expect(await submit(query), kind).toMatchObject({
          status: 303,
          location: "/error?error=consent_failed",
        });
        expect(await db.oAuthConsent.count({ where: { clientId } })).toBe(0);
        expect(
          await db.verificationToken.count({
            where: { token: { contains: clientId } },
          }),
        ).toBe(0);
      }
      expect(await submit(signed, "profile admin:write")).toMatchObject({
        status: 303,
        location: "/error?error=consent_failed",
      });
      expect(await db.oAuthConsent.count({ where: { clientId } })).toBe(0);
      expect(
        await db.verificationToken.count({
          where: { token: { contains: clientId } },
        }),
      ).toBe(0);
      const approval = await submit(signed);
      expect(approval).toMatchObject({
        status: 303,
        location: expect.stringContaining(
          "https://client.example/callback?code=",
        ),
      });
      const consent = await db.oAuthConsent.findUniqueOrThrow({
        where: { clientId_userId: { clientId, userId } },
      });
      expect(consent).toMatchObject({
        scopes: ["openid", "profile"],
        resources: [`${origin}/api/mcp`],
        requestedUserInfoClaims: ["name"],
      });
      const codes = await db.verificationToken.findMany({
        where: { token: { contains: clientId } },
      });
      expect(codes).toHaveLength(1);
      const code = new URL(approval.location).searchParams.get("code");
      expect(code).toBeTruthy();
      if (!code) throw new Error("Expected the actual approval redirect code");
      expect(codes[0].identifier).toBe(
        createHash("sha256").update(code).digest("base64url"),
      );
      const sessions = await db.session.findMany({
        where: { userId },
        select: { id: true },
      });
      expect(sessions).toHaveLength(1);
      expect(JSON.parse(codes[0].token)).toMatchObject({
        sessionId: sessions[0].id,
        userId,
        referenceId: consent.grantId,
        query: {
          scope: "openid profile",
          resource: `${origin}/api/mcp`,
          claims: authorize.get("claims"),
        },
      });
      expect(await readResourcePolicies(db)).toEqual(policies);
    }),
);
