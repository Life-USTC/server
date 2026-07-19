import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";

const authOrigin = "http://localhost:3000";
const createdUserIds: string[] = [];
const verificationCleanupStartedAt = new Date(Date.now() - 1_000);
const encoder = new TextEncoder();

async function authRequest(path: string, init?: RequestInit) {
  const { betterAuthInstance } = await import("@/lib/auth/core");
  return betterAuthInstance.handler(
    new Request(`${authOrigin}/api/auth${path}`, init),
  );
}

function base64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

async function createSessionCookie(userId: string, createdAt?: Date) {
  const token = crypto.randomUUID();
  await prisma.session.create({
    data: {
      expires: new Date(Date.now() + 60 * 60 * 1000),
      sessionToken: token,
      userId,
      ...(createdAt ? { createdAt } : {}),
    },
  });
  const { getBetterAuthInstance } = await import("@/lib/auth/core");
  const context = await getBetterAuthInstance().$context;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(context.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(token),
  );
  const value = encodeURIComponent(
    `${token}.${base64(new Uint8Array(signature))}`,
  );
  return `${context.authCookies.sessionToken.name}=${value}`;
}

async function repeatRequest(count: number, request: () => Promise<Response>) {
  const responses: Response[] = [];
  for (let index = 0; index < count; index += 1) {
    responses.push(await request());
  }
  return responses;
}

describe.sequential("Better Auth passkey integration", () => {
  afterAll(async () => {
    await prisma.verificationToken.deleteMany({
      where: { createdAt: { gte: verificationCleanupStartedAt } },
    });
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    await prisma.$disconnect();
  });

  it("keeps the Better Auth Passkey and legacy Authenticator models separate", async () => {
    const marker = crypto.randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `passkey-integration-${marker}@example.test`,
        name: "Passkey Integration",
      },
      select: { id: true },
    });
    createdUserIds.push(user.id);

    const passkeyId = `passkey-${marker}`;
    const passkeyCredentialId = `better-auth-credential-${marker}`;
    const legacyCredentialId = `legacy-credential-${marker}`;
    await prisma.passkey.create({
      data: {
        id: passkeyId,
        name: "Integration passkey",
        publicKey: "base64-public-key",
        userId: user.id,
        credentialID: passkeyCredentialId,
        counter: 1,
        deviceType: "singleDevice",
        backedUp: false,
        transports: "internal",
        createdAt: new Date(),
        aaguid: "00000000-0000-0000-0000-000000000000",
      },
    });
    await prisma.authenticator.create({
      data: {
        credentialID: legacyCredentialId,
        userId: user.id,
        providerAccountId: `legacy-provider-${marker}`,
        credentialPublicKey: "legacy-public-key",
        counter: 2,
        credentialDeviceType: "singleDevice",
        credentialBackedUp: false,
        transports: "usb",
      },
    });

    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        passkeys: true,
        Authenticator: true,
      },
    });
    expect(storedUser.passkeys).toHaveLength(1);
    expect(storedUser.passkeys[0]).toMatchObject({
      id: passkeyId,
      credentialID: passkeyCredentialId,
      publicKey: "base64-public-key",
    });
    expect(storedUser.Authenticator).toHaveLength(1);
    expect(storedUser.Authenticator[0].credentialID).toBe(legacyCredentialId);

    await prisma.user.delete({ where: { id: user.id } });
    createdUserIds.splice(createdUserIds.indexOf(user.id), 1);
    expect(await prisma.passkey.count({ where: { id: passkeyId } })).toBe(0);
    expect(
      await prisma.authenticator.count({
        where: { credentialID: legacyCredentialId },
      }),
    ).toBe(0);
  });

  it("matches the official Better Auth Passkey columns, indexes, and owner FK", async () => {
    const columns = await prisma.$queryRaw<
      Array<{
        columnName: string;
        dataType: string;
        nullable: "YES" | "NO";
      }>
    >`
      SELECT
        column_name AS "columnName",
        data_type AS "dataType",
        is_nullable AS "nullable"
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Passkey'
      ORDER BY ordinal_position
    `;
    expect(columns).toEqual([
      { columnName: "id", dataType: "text", nullable: "NO" },
      { columnName: "name", dataType: "text", nullable: "YES" },
      { columnName: "publicKey", dataType: "text", nullable: "NO" },
      { columnName: "userId", dataType: "text", nullable: "NO" },
      { columnName: "credentialID", dataType: "text", nullable: "NO" },
      { columnName: "counter", dataType: "integer", nullable: "NO" },
      { columnName: "deviceType", dataType: "text", nullable: "NO" },
      { columnName: "backedUp", dataType: "boolean", nullable: "NO" },
      { columnName: "transports", dataType: "text", nullable: "YES" },
      {
        columnName: "createdAt",
        dataType: "timestamp without time zone",
        nullable: "YES",
      },
      { columnName: "aaguid", dataType: "text", nullable: "YES" },
    ]);

    const indexes = await prisma.$queryRaw<Array<{ indexName: string }>>`
      SELECT indexname AS "indexName"
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'Passkey'
      ORDER BY indexname
    `;
    expect(indexes.map(({ indexName }) => indexName)).toEqual([
      "Passkey_credentialID_idx",
      "Passkey_pkey",
      "Passkey_userId_idx",
    ]);

    const foreignKeys = await prisma.$queryRaw<
      Array<{ deleteAction: string; name: string; targetTable: string }>
    >`
      SELECT
        constraint_name AS "name",
        delete_rule AS "deleteAction",
        unique_constraint_name AS "targetTable"
      FROM information_schema.referential_constraints
      WHERE constraint_schema = 'public'
        AND constraint_name = 'Passkey_userId_fkey'
    `;
    expect(foreignKeys).toEqual([
      {
        name: "Passkey_userId_fkey",
        deleteAction: "CASCADE",
        targetTable: "User_pkey",
      },
    ]);
  });

  it("allows an anonymous authentication challenge but requires a session for registration", async () => {
    const challengeResponse = await authRequest(
      "/passkey/generate-authenticate-options",
      {
        headers: { origin: authOrigin },
      },
    );
    const challenge = (await challengeResponse.json()) as {
      challenge?: unknown;
      rpId?: unknown;
    };

    expect(challengeResponse.status).toBe(200);
    expect(challenge.challenge).toEqual(expect.any(String));
    expect(challenge.rpId).toBe("localhost");
    expect(challengeResponse.headers.get("set-cookie")).toContain(
      "better-auth-passkey",
    );

    const registrationResponse = await authRequest(
      "/passkey/generate-register-options",
      {
        headers: { origin: authOrigin },
      },
    );
    expect(registrationResponse.status).toBe(401);
  });

  it("allows registration options only with an existing trusted session", async () => {
    const marker = crypto.randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `passkey-session-${marker}@example.test`,
        name: "Passkey Session",
      },
      select: { id: true },
    });
    createdUserIds.push(user.id);
    const cookie = await createSessionCookie(user.id);

    const response = await authRequest(
      "/passkey/generate-register-options?name=Primary",
      {
        headers: {
          cookie,
          origin: authOrigin,
        },
      },
    );
    const payload = (await response.json()) as {
      challenge?: unknown;
      rp?: { id?: unknown; name?: unknown };
    };

    expect(response.status).toBe(200);
    expect(payload.challenge).toEqual(expect.any(String));
    expect(payload.rp).toEqual({
      id: "localhost",
      name: "Life@USTC",
    });

    const staleCookie = await createSessionCookie(
      user.id,
      new Date(Date.now() - 25 * 60 * 60 * 1000),
    );
    const staleResponse = await authRequest(
      "/passkey/generate-register-options?name=Stale",
      {
        headers: {
          cookie: staleCookie,
          origin: authOrigin,
        },
      },
    );
    expect(staleResponse.status).toBe(403);
  });

  it("rejects cookie-backed verification from missing or untrusted origins", async () => {
    const request = (origin?: string) =>
      authRequest("/passkey/verify-authentication", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "better-auth-passkey=test-challenge",
          ...(origin ? { origin } : {}),
        },
        body: JSON.stringify({ response: {} }),
      });

    expect((await request()).status).toBe(403);
    expect((await request("https://evil.example")).status).toBe(403);
    expect((await request(authOrigin)).status).toBe(400);
  });

  it("rate-limits only the anonymous passkey challenge and verification paths", async () => {
    const requestChallenge = () =>
      authRequest("/passkey/generate-authenticate-options", {
        headers: {
          origin: authOrigin,
          "x-forwarded-for": "198.51.100.27",
        },
      });
    const requestVerification = () =>
      authRequest("/passkey/verify-authentication", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: authOrigin,
          "x-forwarded-for": "198.51.100.28",
        },
        body: JSON.stringify({ response: {} }),
      });

    const challengeResponses = await repeatRequest(20, requestChallenge);
    expect(challengeResponses.every(({ status }) => status === 200)).toBe(true);
    expect((await requestChallenge()).status).toBe(429);
    expect(
      (
        await authRequest("/passkey/list-user-passkeys", {
          headers: {
            origin: authOrigin,
            "x-forwarded-for": "198.51.100.27",
          },
        })
      ).status,
    ).toBe(401);

    const verificationResponses = await repeatRequest(10, requestVerification);
    expect(verificationResponses.every(({ status }) => status === 400)).toBe(
      true,
    );
    expect((await requestVerification()).status).toBe(429);
  });
});
