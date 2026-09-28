import { createServer, type Server } from "node:http";
import type { Cookies } from "@sveltejs/kit";
import { getRequest, setResponse } from "@sveltejs/kit/node";
import { getCookies } from "better-auth/cookies";
import { makeSignature } from "better-auth/crypto";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import { refreshWelcomeOAuthProfile } from "@/features/welcome/server/welcome-oauth-refresh-action";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const nativeFetch = globalThis.fetch;
const marker = crypto.randomUUID();
const email = `${marker}@social-contract.test`;
let server: Server;
let origin: string;
let upstreamTokenRequests = 0;
let clientNumber = 0;
const providerUsers: string[] = [];
const oidcSubject = `oidc-${marker}`;
beforeEach(() => {
  clientNumber++;
});
let upstreamName = "Upstream profile";
let upstreamImage = "https://example.test/upstream-avatar.png";
const cookies = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .filter((value) => value.slice(value.indexOf("=") + 1).length > 0)
    .join("; ");

beforeAll(async () => {
  server = createServer(async (incoming, outgoing) => {
    try {
      const request = await getRequest({ request: incoming, base: origin });
      request.headers.set("cf-connecting-ip", `192.0.2.${clientNumber}`);
      await setResponse(
        outgoing,
        await getBetterAuthInstance().handler(request),
      );
    } catch {
      outgoing.statusCode = 500;
      outgoing.end("Social contract server failed");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing address");
  origin = `http://127.0.0.1:${address.port}`;
  vi.stubEnv("APP_PUBLIC_ORIGIN", origin);
  vi.stubEnv("APP_CANONICAL_ORIGIN", origin);
  vi.stubEnv("AUTH_GITHUB_ID", "social-contract-client");
  vi.stubEnv("AUTH_GITHUB_SECRET", "social-contract-secret");
  vi.stubEnv("AUTH_GOOGLE_ID", "google-contract-client");
  vi.stubEnv("AUTH_GOOGLE_SECRET", "google-contract-secret");
  vi.stubEnv("AUTH_OIDC_CLIENT_ID", "oidc-contract-client");
  vi.stubEnv("AUTH_OIDC_CLIENT_SECRET", "oidc-contract-secret");
  vi.stubEnv("AUTH_OIDC_ISSUER", "https://oidc.example.test");
  const keys = await generateKeyPair("RS256");
  const googleJwk = {
    ...(await exportJWK(keys.publicKey)),
    kid: "social-contract-key",
    alg: "RS256",
    use: "sig",
  };
  const googleToken = await new SignJWT({
    sub: `google-${marker}`,
    name: "Google profile",
    email: `google-${email}`,
    email_verified: true,
  })
    .setProtectedHeader({ alg: "RS256", kid: googleJwk.kid })
    .setIssuer("https://accounts.google.com")
    .setAudience("google-contract-client")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(keys.privateKey);
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (
        url.hostname === "github.com" &&
        url.pathname === "/login/oauth/access_token"
      ) {
        upstreamTokenRequests++;
        return Response.json({
          access_token: "controlled-upstream-token",
          token_type: "bearer",
          scope: "read:user user:email",
        });
      }
      if (url.hostname === "api.github.com" && url.pathname === "/user")
        return Response.json({
          id: 1900260927,
          login: "social-contract",
          name: upstreamName,
          email,
          avatar_url: upstreamImage,
        });
      if (url.hostname === "api.github.com" && url.pathname === "/user/emails")
        return Response.json([
          { email, primary: true, verified: true, visibility: "public" },
        ]);
      if (url.href === "https://oauth2.googleapis.com/token")
        return Response.json({
          access_token: "google-controlled-token",
          id_token: googleToken,
          token_type: "Bearer",
          expires_in: 300,
        });
      if (url.href === "https://www.googleapis.com/oauth2/v3/certs")
        return Response.json({ keys: [googleJwk] });
      if (url.href === "https://oidc.example.test/token/")
        return Response.json({
          access_token: "oidc-controlled-token",
          token_type: "Bearer",
          expires_in: 300,
        });
      if (url.href === "https://oidc.example.test/userinfo/")
        return Response.json({ sub: oidcSubject, name: "USTC profile" });
      if (url.origin === origin) return nativeFetch(input, init);
      throw new Error(
        `Unexpected provider request: ${url.origin}${url.pathname}`,
      );
    },
  );
});
afterEach(async () => {
  await db.user.deleteMany({
    where: { OR: [{ email }, { id: { in: providerUsers } }] },
  });
  upstreamName = "Upstream profile";
  upstreamImage = "https://example.test/upstream-avatar.png";
});
afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await db.user.deleteMany({
    where: { OR: [{ email }, { id: { in: providerUsers } }] },
  });
  await Promise.all([
    db.$disconnect(),
    runtimePrisma.$disconnect(),
    authPrisma.$disconnect(),
  ]);
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

async function start() {
  const response = await nativeFetch(`${origin}/api/auth/sign-in/social`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({
      provider: "github",
      callbackURL: `${origin}/catalog/courses?from=oauth`,
      disableRedirect: true,
    }),
  });
  expect(response.status).toBe(200);
  const authorization = new URL((await response.json()).url);
  expect(authorization.origin).toBe("https://github.com");
  expect(authorization.searchParams.get("redirect_uri")).toBe(
    `${origin}/api/auth/callback/github`,
  );
  const state = authorization.searchParams.get("state");
  expect(state).toBeTruthy();
  return { state: state as string, cookie: cookies(response) };
}

it("user.oauth-callback-integrity", async () => {
  for (const variant of ["wrong-state", "missing-cookie"] as const) {
    const flow = await start();
    const before = upstreamTokenRequests;
    const response = await nativeFetch(
      `${origin}/api/auth/callback/github?code=controlled-code&state=${variant === "wrong-state" ? "incorrect-state" : encodeURIComponent(flow.state)}`,
      {
        headers: { cookie: variant === "missing-cookie" ? "" : flow.cookie },
        redirect: "manual",
      },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("error=");
    await response.text();
    expect(upstreamTokenRequests).toBe(before);
    expect(await db.user.count({ where: { email } })).toBe(0);
  }
  const flow = await start();
  const callback = `${origin}/api/auth/callback/github?code=controlled-code&state=${encodeURIComponent(flow.state)}`;
  const response = await nativeFetch(callback, {
    headers: { cookie: flow.cookie },
    redirect: "manual",
  });
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe(
    `${origin}/catalog/courses?from=oauth`,
  );
  await response.text();
  const sessionResponse = await nativeFetch(
    `${origin}/api/auth/get-session?disableCookieCache=true`,
    { headers: { cookie: cookies(response) } },
  );
  expect(sessionResponse.status).toBe(200);
  const session = await sessionResponse.json();
  expect(session.user).toMatchObject({ email, name: "" });
  const account = await db.account.findFirstOrThrow({
    where: { userId: session.user.id, provider: "github" },
  });
  expect(account.providerAccountId).toBe("1900260927");
  expect(await db.session.count({ where: { userId: session.user.id } })).toBe(
    1,
  );
  const before = upstreamTokenRequests;
  const replay = await nativeFetch(callback, {
    headers: { cookie: flow.cookie },
    redirect: "manual",
  });
  expect(replay.status).toBe(302);
  expect(replay.headers.get("location")).toContain("error=");
  await replay.text();
  expect(upstreamTokenRequests).toBe(before);
  expect(await db.session.count({ where: { userId: session.user.id } })).toBe(
    1,
  );
});

it("user.welcome-oauth-refresh", async () => {
  const flow = await start();
  const response = await nativeFetch(
    `${origin}/api/auth/callback/github?code=controlled-code&state=${encodeURIComponent(flow.state)}`,
    { headers: { cookie: flow.cookie }, redirect: "manual" },
  );
  expect(response.headers.get("location")).toBe(
    `${origin}/catalog/courses?from=oauth`,
  );
  await response.text();
  const sessionCookie = cookies(response);
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const customImage = "https://example.test/user-choice.png";
  await db.user.update({
    where: { id: user.id },
    data: {
      name: "User chosen name",
      username: "socialchosen",
      image: customImage,
    },
  });
  const grantsBefore = await db.oAuthConsent.count({
    where: { userId: user.id },
  });
  async function refresh(providerId: string) {
    const setCookies: string[] = [];
    const input = {
      cookies: {
        set: (name: string, value: string) => {
          setCookies.push(`${name}=${encodeURIComponent(value)}`);
        },
      } as unknown as Cookies,
      locals: {
        locale: "en-us",
        requestId: "social-refresh-contract",
      } as App.Locals,
      request: new Request(`${origin}/account/welcome?/refreshOAuth`, {
        method: "POST",
        headers: { cookie: sessionCookie, origin },
        body: new URLSearchParams({
          providerId,
          callbackUrl: "/account/settings/profile",
        }),
      }),
    };
    try {
      return { result: await refreshWelcomeOAuthProfile(input), setCookies };
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        "location" in error
      )
        return {
          redirect: error as { status: number; location: string },
          setCookies,
        };
      throw error;
    }
  }
  for (const provider of ["google", "unsupported"]) {
    const rejected = await refresh(provider);
    expect(rejected.result?.status).toBe(400);
    expect(rejected.setCookies).toEqual([]);
  }
  for (const mode of ["preserve", "empty-profile"] as const) {
    if (mode === "empty-profile")
      await db.user.update({
        where: { id: user.id },
        data: { name: "", username: null, image: null },
      });
    upstreamName = `Updated upstream ${mode}`;
    upstreamImage = `https://example.test/upstream-${mode}.png`;
    const initiated = await refresh("github");
    expect(initiated.redirect?.status).toBe(303);
    const authorization = new URL(initiated.redirect?.location ?? "");
    expect(authorization.origin).toBe("https://github.com");
    const state = authorization.searchParams.get("state");
    expect(state).toBeTruthy();
    const callback = await nativeFetch(
      `${origin}/api/auth/callback/github?code=refresh-code&state=${encodeURIComponent(state ?? "")}`,
      {
        headers: {
          cookie: [sessionCookie, ...initiated.setCookies].join("; "),
        },
        redirect: "manual",
      },
    );
    expect(callback.status).toBe(302);
    expect(
      new URL(callback.headers.get("location") ?? "", origin).pathname,
      callback.headers.get("location") ?? "Missing callback destination",
    ).toBe("/account/welcome");
    expect(
      new URL(callback.headers.get("location") ?? "", origin).searchParams.get(
        "oauthRefreshed",
      ),
    ).toBe("1");
    await callback.text();
    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.name).toBe(mode === "preserve" ? "User chosen name" : "");
    expect(updated.image).toBe(
      mode === "preserve" ? customImage : upstreamImage,
    );
    expect(updated.username).toBe(mode === "preserve" ? "socialchosen" : null);
    expect(updated.profilePictures).toContain(upstreamImage);
    expect(
      await db.account.count({
        where: { userId: user.id, provider: "github" },
      }),
    ).toBe(1);
    expect(await db.oAuthConsent.count({ where: { userId: user.id } })).toBe(
      grantsBefore,
    );
  }
});

it("user.explicit-provider-linking", async () => {
  const owner = await db.user.create({
    data: { email, emailVerified: true, name: "Existing verified user" },
  });
  const flow = await start();
  const implicit = await nativeFetch(
    `${origin}/api/auth/callback/github?code=unlinked-code&state=${encodeURIComponent(flow.state)}`,
    { headers: { cookie: flow.cookie }, redirect: "manual" },
  );
  expect(implicit.status).toBe(302);
  expect(implicit.headers.get("location")).toContain("error=");
  await implicit.text();
  expect(await db.account.count({ where: { userId: owner.id } })).toBe(0);
  expect(await db.session.count({ where: { userId: owner.id } })).toBe(0);
  async function sessionFor(userId: string) {
    const token = crypto.randomUUID();
    await db.session.create({
      data: {
        userId,
        sessionToken: token,
        expires: new Date(Date.now() + 3600000),
      },
    });
    const secret = (await getBetterAuthInstance().$context).secret;
    return `${getCookies({ baseURL: origin }).sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, secret)}`)}`;
  }
  const link = async (cookie: string) => {
    const response = await nativeFetch(`${origin}/api/auth/link-social`, {
      method: "POST",
      headers: { origin, cookie, "content-type": "application/json" },
      body: JSON.stringify({
        provider: "github",
        callbackURL: `${origin}/account/settings/linked-accounts`,
        disableRedirect: true,
      }),
    });
    expect(response.status).toBe(200);
    const authorization = new URL((await response.json()).url);
    const callback = await nativeFetch(
      `${origin}/api/auth/callback/github?code=explicit-link&state=${encodeURIComponent(authorization.searchParams.get("state") ?? "")}`,
      {
        headers: { cookie: [cookie, cookies(response)].join("; ") },
        redirect: "manual",
      },
    );
    return callback;
  };
  const authorized = await link(await sessionFor(owner.id));
  expect(authorized.headers.get("location")).toBe(
    `${origin}/account/settings/linked-accounts`,
  );
  await authorized.text();
  expect(
    await db.account.count({ where: { userId: owner.id, provider: "github" } }),
  ).toBe(1);
  const other = await db.user.create({
    data: { email: `other-${email}`, name: "Other identity" },
  });
  try {
    const blocked = await link(await sessionFor(other.id));
    expect(blocked.status).toBe(302);
    const location = blocked.headers.get("location") ?? "";
    expect(new URL(location, origin).searchParams.get("error")).toBe(
      "account_already_linked_to_different_user",
    );
    const body = await blocked.text();
    for (const privateValue of [owner.id, owner.name, owner.email]) {
      if (!privateValue)
        throw new Error("Expected an identifiable fixture owner");
      expect(location).not.toContain(privateValue);
      expect(location).not.toContain(encodeURIComponent(privateValue));
      expect(body).not.toContain(privateValue);
    }
    expect(await db.account.count({ where: { userId: other.id } })).toBe(0);
    expect(
      await db.account.count({
        where: { userId: owner.id, provider: "github" },
      }),
    ).toBe(1);
  } finally {
    await db.user.delete({ where: { id: other.id } });
  }
});

it("user.sign-in-providers", async () => {
  for (const [
    provider,
    endpoint,
    callbackPath,
    expectedSubject,
    upstreamOrigin,
  ] of [
    [
      "github",
      "/sign-in/social",
      "/callback/github",
      "1900260927",
      "https://github.com",
    ],
    [
      "google",
      "/sign-in/social",
      "/callback/google",
      `google-${marker}`,
      "https://accounts.google.com",
    ],
    [
      "oidc",
      "/sign-in/social",
      "/callback/oidc",
      oidcSubject,
      "https://oidc.example.test",
    ],
  ]) {
    const started = await nativeFetch(`${origin}/api/auth${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({
        provider,
        callbackURL: `${origin}/workspace/overview`,
        disableRedirect: true,
      }),
    });
    expect(started.status).toBe(200);
    const authorization = new URL((await started.json()).url);
    expect(authorization.origin).toBe(upstreamOrigin);
    expect(authorization.searchParams.get("redirect_uri")).toBe(
      `${origin}/api/auth${callbackPath}`,
    );
    expect(authorization.searchParams.get("state")).toBeTruthy();
    const completed = await nativeFetch(
      `${origin}/api/auth${callbackPath}?${new URLSearchParams({ code: "controlled-code", state: authorization.searchParams.get("state") ?? "" })}`,
      { headers: { cookie: cookies(started) }, redirect: "manual" },
    );
    expect(completed.status).toBe(302);
    expect(completed.headers.get("location")).toBe(
      `${origin}/workspace/overview`,
    );
    await completed.text();
    const sessionResponse = await nativeFetch(
      `${origin}/api/auth/get-session?disableCookieCache=true`,
      { headers: { cookie: cookies(completed) } },
    );
    expect(sessionResponse.status).toBe(200);
    const current = await sessionResponse.json();
    expect(current.user.name).toBe("");
    providerUsers.push(current.user.id);
    const user = await db.user.findUniqueOrThrow({
      where: { id: current.user.id },
    });
    expect(user.name).toBe("");
    expect(user.username).toBeNull();
    const accounts = await db.account.findMany({
      where: { userId: current.user.id },
    });
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      provider,
      providerAccountId: expectedSubject,
    });
    expect(accounts[0].password).toBeNull();
  }
});
