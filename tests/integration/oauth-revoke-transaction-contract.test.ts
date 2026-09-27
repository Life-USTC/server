import { afterAll, beforeAll, expect, it } from "vitest";
import { revokeUserOAuthAuthorization } from "@/features/oauth/server/user-authorizations.server";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const users = [`revoke-user-${marker}`, `revoke-other-${marker}`];
const clients = [`revoke-client-${marker}`, `revoke-unrelated-${marker}`];
const pairs = [
  { userId: users[0], clientId: clients[0] },
  { userId: users[1], clientId: clients[0] },
  { userId: users[0], clientId: clients[1] },
];
const consents: string[] = [];
beforeAll(async () => {
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
});
afterAll(async () => {
  await db.auditLog.deleteMany({ where: { oauthClientId: { in: clients } } });
  await db.oAuthClient.deleteMany({ where: { clientId: { in: clients } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
async function material(pair: (typeof pairs)[number]) {
  const [consents, access, refresh, devices, usage] = await Promise.all([
    db.oAuthConsent.findMany({ where: pair, orderBy: { id: "asc" } }),
    db.oAuthAccessToken.findMany({ where: pair, orderBy: { id: "asc" } }),
    db.oAuthRefreshToken.findMany({ where: pair, orderBy: { id: "asc" } }),
    db.deviceCode.findMany({ where: pair, orderBy: { id: "asc" } }),
    db.oAuthGrantUsageDaily.findMany({ where: pair, orderBy: { id: "asc" } }),
  ]);
  return { consents, access, refresh, devices, usage };
}
it("oauth.authorization-management.ownership-scoped-transaction", async () => {
  const before = await Promise.all(pairs.map(material));
  expect(await revokeUserOAuthAuthorization(users[0], consents[1])).toEqual({
    ok: false,
    reason: "not_found",
  });
  // A real database enum failure occurs at the final audit insert inside the transaction.
  await expect(
    revokeUserOAuthAuthorization(users[0], consents[0], {
      channel: "invalid-audit-channel" as "web",
    }),
  ).rejects.toThrow();
  expect(await Promise.all(pairs.map(material))).toEqual(before);
  expect(
    await db.auditLog.count({
      where: {
        oauthClientId: clients[0],
        action: "oauth_authorization_revoke",
      },
    }),
  ).toBe(0);
  expect(await revokeUserOAuthAuthorization(users[0], consents[0])).toEqual({
    ok: true,
    deleted: { accessTokens: 1, consents: 1, deviceCodes: 2, refreshTokens: 1 },
  });
  expect(await material(pairs[0])).toEqual({
    consents: [],
    access: [],
    refresh: [],
    devices: [],
    usage: [],
  });
  expect(await material(pairs[1])).toEqual(before[1]);
  expect(await material(pairs[2])).toEqual(before[2]);
  const audit = await db.auditLog.findMany({
    where: { oauthClientId: clients[0], action: "oauth_authorization_revoke" },
  });
  expect(audit).toEqual([
    expect.objectContaining({
      subjectUserId: users[0],
      targetId: consents[0],
      oauthGrantId: before[0].consents[0].grantId,
    }),
  ]);
});
