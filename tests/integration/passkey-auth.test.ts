import { makeSignature } from "better-auth/crypto";
import { describe } from "vitest";
import { getBetterAuthInstance } from "@/lib/auth/core";
import type { Prisma } from "../../src/generated/prisma-node/client";
import { nodeProtocolTest } from "../shared/node-protocol-fixture";

const authOrigin = "http://localhost:3000";

// Better Auth normalizes IPv6 to /64. Randomize the prefix, not only the host.
function privateClientIp() {
  const prefix = crypto.getRandomValues(new Uint16Array(4));
  prefix[0] = 0xfd00 | (prefix[0] & 0xff);
  return `${Array.from(prefix, (part) => part.toString(16)).join(":")}::1`;
}

const it = nodeProtocolTest
  .extend({
    protocolBindings: {
      NODE_ENV: "test",
      E2E_DEBUG_AUTH: "",
      APP_CANONICAL_ORIGIN: authOrigin,
    },
  })
  .extend("passkey", async ({ protocolRuntime, task }) =>
    protocolRuntime.run(async () => {
      const { expect } = task.context;
      // These bindings must precede the first construction of the module's auth
      // singleton. This fixture does not isolate heterogeneous singleton configs.
      const auth = getBetterAuthInstance();
      const context = await auth.$context;
      expect(context.rateLimit.enabled).toBe(true);
      expect(context.rateLimit.storage).toBe("memory");
      const clientIp = privateClientIp();
      return {
        authRequest: (path: string, init?: RequestInit) =>
          protocolRuntime.request(() => {
            const headers = new Headers(init?.headers);
            if (!headers.has("cf-connecting-ip"))
              headers.set("cf-connecting-ip", clientIp);
            return auth.handler(
              new Request(`${authOrigin}/api/auth${path}`, {
                ...init,
                headers,
              }),
            );
          }),
        signSessionToken: async (token: string) => {
          const value = encodeURIComponent(
            `${token}.${await makeSignature(token, context.secret)}`,
          );
          return `${context.authCookies.sessionToken.name}=${value}`;
        },
      };
    }),
  );

async function createSession(
  db: Prisma.TransactionClient,
  userId: string,
  createdAt?: Date,
) {
  const token = crypto.randomUUID();
  await db.session.create({
    data: {
      expires: new Date(Date.now() + 60 * 60 * 1000),
      sessionToken: token,
      userId,
      ...(createdAt ? { createdAt } : {}),
    },
  });
  return token;
}

// Status-only callers still consume the actual response, including challenges.
async function consume(response: Response) {
  await response.text();
  return response;
}

async function repeatRequest(count: number, request: () => Promise<Response>) {
  const responses: Response[] = [];
  for (let index = 0; index < count; index += 1) {
    responses.push(await request());
  }
  return responses;
}

describe("Better Auth passkey integration", () => {
  it("keeps the Better Auth Passkey and legacy Authenticator models separate", {
    tags: ["@Account/OAuth"],
  }, async ({
    isolatedDatabase: { owner: fixturePrisma },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const marker = crypto.randomUUID();
      const { user, passkeyId, passkeyCredentialId, legacyCredentialId } =
        await fixturePrisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: `passkey-integration-${marker}@example.test`,
              name: "Passkey Integration",
            },
            select: { id: true },
          });

          const passkeyId = `passkey-${marker}`;
          const passkeyCredentialId = `better-auth-credential-${marker}`;
          const legacyCredentialId = `legacy-credential-${marker}`;
          await tx.passkey.create({
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
          await tx.authenticator.create({
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

          return { user, passkeyId, passkeyCredentialId, legacyCredentialId };
        });

      const storedUser = await fixturePrisma.user.findUniqueOrThrow({
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

      await fixturePrisma.user.delete({ where: { id: user.id } });
      expect(
        await fixturePrisma.passkey.count({ where: { id: passkeyId } }),
      ).toBe(0);
      expect(
        await fixturePrisma.authenticator.count({
          where: { credentialID: legacyCredentialId },
        }),
      ).toBe(0);
    });
  });

  it("matches the official Better Auth Passkey columns, indexes, and owner FK", {
    tags: ["@Account/OAuth"],
  }, async ({
    isolatedDatabase: { owner: fixturePrisma },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const columns = await fixturePrisma.$queryRaw<
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

      const indexes = await fixturePrisma.$queryRaw<
        Array<{ indexName: string }>
      >`
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

      const foreignKeys = await fixturePrisma.$queryRaw<
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
  });

  it("allows an anonymous authentication challenge but requires a session for registration", {
    tags: ["@Account/OAuth"],
  }, async ({ passkey: { authRequest }, protocolRuntime, expect }) => {
    await protocolRuntime.run(async () => {
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
      await registrationResponse.text();
    });
  });

  it("allows registration options only with an existing trusted session", {
    tags: ["@Account/OAuth"],
  }, async ({
    passkey: { authRequest, signSessionToken },
    isolatedDatabase: { owner: fixturePrisma },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const marker = crypto.randomUUID();
      const { freshToken, staleToken } = await fixturePrisma.$transaction(
        async (tx) => {
          const user = await tx.user.create({
            data: {
              email: `passkey-session-${marker}@example.test`,
              name: "Passkey Session",
            },
            select: { id: true },
          });
          return {
            freshToken: await createSession(tx, user.id),
            staleToken: await createSession(
              tx,
              user.id,
              new Date(Date.now() - 16 * 60 * 1000),
            ),
          };
        },
      );
      const cookie = await signSessionToken(freshToken);

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

      const staleCookie = await signSessionToken(staleToken);
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
      await staleResponse.text();
    });
  });

  it("requires an authoritative recent session for passkey rename and delete", {
    tags: ["@Account/OAuth"],
  }, async ({
    passkey: { authRequest, signSessionToken },
    isolatedDatabase: { owner: fixturePrisma },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const marker = crypto.randomUUID();
      const { passkeyId, freshToken, staleToken } =
        await fixturePrisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: `passkey-sensitive-${marker}@example.test`,
              name: "Passkey Sensitive",
            },
            select: { id: true },
          });
          const passkeyId = `passkey-sensitive-${marker}`;
          await tx.passkey.create({
            data: {
              id: passkeyId,
              name: "Original",
              publicKey: "base64-public-key",
              userId: user.id,
              credentialID: `credential-sensitive-${marker}`,
              counter: 1,
              deviceType: "singleDevice",
              backedUp: false,
              transports: "internal",
              createdAt: new Date(),
            },
          });

          // This scenario tests session freshness while retaining a second sign-in
          // method; deleting the sole method is covered by the removal policy.
          await tx.passkey.create({
            data: {
              name: "Backup",
              publicKey: "backup-public-key",
              userId: user.id,
              credentialID: `backup-sensitive-${marker}`,
              counter: 0,
              deviceType: "singleDevice",
              backedUp: false,
            },
          });
          return {
            passkeyId,
            freshToken: await createSession(tx, user.id),
            staleToken: await createSession(
              tx,
              user.id,
              new Date(Date.now() - 16 * 60 * 1000),
            ),
          };
        });
      const staleCookie = await signSessionToken(staleToken);
      const staleRename = await authRequest("/passkey/update-passkey", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: staleCookie,
          origin: authOrigin,
        },
        body: JSON.stringify({ id: passkeyId, name: "Stale rename" }),
      });
      expect(staleRename.status).toBe(403);
      await staleRename.text();
      await expect(
        fixturePrisma.passkey.findUniqueOrThrow({ where: { id: passkeyId } }),
      ).resolves.toMatchObject({ name: "Original" });

      const freshCookie = await signSessionToken(freshToken);
      const rename = await authRequest("/passkey/update-passkey", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: freshCookie,
          origin: authOrigin,
        },
        body: JSON.stringify({ id: passkeyId, name: "Renamed" }),
      });
      expect(rename.status).toBe(200);
      await rename.text();

      const staleDelete = await authRequest("/passkey/delete-passkey", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: staleCookie,
          origin: authOrigin,
        },
        body: JSON.stringify({ id: passkeyId }),
      });
      expect(staleDelete.status).toBe(403);
      await staleDelete.text();
      expect(
        await fixturePrisma.passkey.count({ where: { id: passkeyId } }),
      ).toBe(1);

      const deletion = await authRequest("/passkey/delete-passkey", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: freshCookie,
          origin: authOrigin,
        },
        body: JSON.stringify({ id: passkeyId }),
      });
      expect(deletion.status).toBe(200);
      await deletion.text();
      expect(
        await fixturePrisma.passkey.count({ where: { id: passkeyId } }),
      ).toBe(0);

      const audit = await fixturePrisma.auditLog.findMany({
        where: { targetId: passkeyId },
        orderBy: { createdAt: "asc" },
        select: { action: true, outcome: true, targetId: true },
      });
      expect(audit).toEqual([
        {
          action: "account_passkey_update",
          outcome: "success",
          targetId: passkeyId,
        },
        {
          action: "account_passkey_delete",
          outcome: "success",
          targetId: passkeyId,
        },
      ]);
    });
  });

  it("rejects cookie-backed verification from missing or untrusted origins", {
    tags: ["@Account/OAuth"],
  }, async ({ passkey: { authRequest }, protocolRuntime, expect }) => {
    await protocolRuntime.run(async () => {
      const request = (origin?: string) =>
        authRequest("/passkey/verify-authentication", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "better-auth-passkey=test-challenge",
            ...(origin ? { origin } : {}),
          },
          body: JSON.stringify({ response: {} }),
        }).then(consume);

      expect((await request()).status).toBe(403);
      expect((await request("https://evil.example")).status).toBe(403);
      expect((await request(authOrigin)).status).toBe(400);
    });
  });

  it("rate-limits only the anonymous passkey challenge and verification paths", {
    tags: ["@Account/OAuth"],
  }, async ({ passkey: { authRequest }, protocolRuntime, expect }) => {
    await protocolRuntime.run(async () => {
      const challengeIp = privateClientIp();
      const verificationIp = privateClientIp();
      const requestChallenge = () =>
        authRequest("/passkey/generate-authenticate-options", {
          headers: {
            origin: authOrigin,
            "cf-connecting-ip": challengeIp,
          },
        }).then(consume);
      const requestVerification = () =>
        authRequest("/passkey/verify-authentication", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: authOrigin,
            "cf-connecting-ip": verificationIp,
          },
          body: JSON.stringify({ response: {} }),
        }).then(consume);

      const challengeResponses = await repeatRequest(20, requestChallenge);
      expect(challengeResponses.every(({ status }) => status === 200)).toBe(
        true,
      );
      expect((await requestChallenge()).status).toBe(429);
      expect(
        (
          await authRequest("/passkey/list-user-passkeys", {
            headers: {
              origin: authOrigin,
              "cf-connecting-ip": challengeIp,
            },
          }).then(consume)
        ).status,
      ).toBe(401);

      const verificationResponses = await repeatRequest(
        10,
        requestVerification,
      );
      expect(verificationResponses.every(({ status }) => status === 400)).toBe(
        true,
      );
      expect((await requestVerification()).status).toBe(429);
    });
  });
});
