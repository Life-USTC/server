import { expect } from "vitest";
import { revokeUserOAuthAuthorization } from "@/features/oauth/server/user-authorizations.server";
import { isolatedNodeTest } from "../shared/isolated-node-fixture";
import type { TestPrismaClient } from "../shared/prisma";

function prepareRevocation(owner: TestPrismaClient) {
  return owner.$transaction(async (db) => {
    const marker = "revoke";
    const users = [`revoke-user-${marker}`, `revoke-other-${marker}`];
    const clients = [`revoke-client-${marker}`, `revoke-unrelated-${marker}`];
    const pairs = [
      { userId: users[0], clientId: clients[0] },
      { userId: users[1], clientId: clients[0] },
      { userId: users[0], clientId: clients[1] },
    ];
    const consents: string[] = [];
    for (const id of users)
      await db.user.create({ data: { id, email: `${id}@example.test` } });
    for (const clientId of clients)
      await db.oAuthClient.create({
        data: { clientId, name: marker, skipConsent: false },
      });
    for (const pair of pairs) {
      const consent = await db.oAuthConsent.create({
        data: { ...pair, scopes: ["profile"] },
      });
      consents.push(consent.id);
      const refresh = await db.oAuthRefreshToken.create({
        data: {
          ...pair,
          token: crypto.randomUUID(),
          grantId: consent.grantId,
          referenceId: consent.grantId,
          scopes: ["profile"],
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      await db.oAuthAccessToken.create({
        data: {
          ...pair,
          token: crypto.randomUUID(),
          grantId: consent.grantId,
          referenceId: consent.grantId,
          refreshId: refresh.id,
          scopes: ["profile"],
          expiresAt: new Date(Date.now() + 600000),
        },
      });
      for (const status of ["pending", "approved"])
        await db.deviceCode.create({
          data: {
            ...pair,
            deviceCode: crypto.randomUUID(),
            userCode: crypto.randomUUID(),
            status,
            scopes: ["profile"],
            expiresAt: new Date(Date.now() + 600000),
          },
        });
      await db.oAuthGrantUsageDaily.create({
        data: {
          ...pair,
          grantId: consent.grantId,
          grantKey: `grant:${consent.grantId}`,
          day: new Date(),
          feature: "account.profile",
          channel: "rest",
          readCount: 1,
          lastUsedAt: new Date(),
        },
      });
    }
    return { users, clients, pairs, consents };
  });
}
const test = isolatedNodeTest.extend<{
  revocation: Awaited<ReturnType<typeof prepareRevocation>>;
}>({
  revocation: async ({ isolatedDatabase, nodeRuntime }, use) => {
    const state = await nodeRuntime.run(() =>
      prepareRevocation(isolatedDatabase.owner),
    );
    await use(state);
  },
});
async function material(
  db: TestPrismaClient,
  pair: { userId: string; clientId: string },
) {
  const [consents, access, refresh, devices, usage] = await Promise.all([
    db.oAuthConsent.findMany({ where: pair, orderBy: { id: "asc" } }),
    db.oAuthAccessToken.findMany({ where: pair, orderBy: { id: "asc" } }),
    db.oAuthRefreshToken.findMany({ where: pair, orderBy: { id: "asc" } }),
    db.deviceCode.findMany({ where: pair, orderBy: { id: "asc" } }),
    db.oAuthGrantUsageDaily.findMany({ where: pair, orderBy: { id: "asc" } }),
  ]);
  return { consents, access, refresh, devices, usage };
}
test(
  "oauth.authorization-management.ownership-scoped-transaction",
  { tags: ["@OAuth/Service"] },
  async ({ revocation, isolatedDatabase: { owner: db }, nodeRuntime }) =>
    nodeRuntime.run(async () => {
      const { users, clients, pairs, consents } = revocation;
      const before = await Promise.all(pairs.map((pair) => material(db, pair)));
      expect(await revokeUserOAuthAuthorization(users[0], consents[1])).toEqual(
        {
          ok: false,
          reason: "not_found",
        },
      );
      // A real database enum failure occurs at the final audit insert inside the transaction.
      await expect(
        revokeUserOAuthAuthorization(users[0], consents[0], {
          channel: "invalid-audit-channel" as "web",
        }),
      ).rejects.toThrow();
      expect(
        await Promise.all(pairs.map((pair) => material(db, pair))),
      ).toEqual(before);
      expect(
        await db.auditLog.count({
          where: {
            oauthClientId: clients[0],
            action: "oauth_authorization_revoke",
          },
        }),
      ).toBe(0);
      expect(await revokeUserOAuthAuthorization(users[0], consents[0])).toEqual(
        {
          ok: true,
          deleted: {
            accessTokens: 1,
            consents: 1,
            deviceCodes: 2,
            refreshTokens: 1,
          },
        },
      );
      expect(await material(db, pairs[0])).toEqual({
        consents: [],
        access: [],
        refresh: [],
        devices: [],
        usage: [],
      });
      expect(await material(db, pairs[1])).toEqual(before[1]);
      expect(await material(db, pairs[2])).toEqual(before[2]);
      const audit = await db.auditLog.findMany({
        where: {
          oauthClientId: clients[0],
          action: "oauth_authorization_revoke",
        },
      });
      expect(audit).toEqual([
        expect.objectContaining({
          subjectUserId: users[0],
          targetId: consents[0],
          oauthGrantId: before[0].consents[0].grantId,
        }),
      ]);
    }),
);
