import { describe, expect } from "vitest";
import {
  type OAuthUserGrantEvidence,
  resolveActiveOAuthUserGrant,
} from "@/lib/oauth/active-user-grant";
import { OAUTH_REFRESH_REPLAY_TOMBSTONE_SCOPE } from "@/lib/oauth/constants";
import { nodeProtocolTest } from "../shared/node-protocol-fixture";

const test = nodeProtocolTest.extend<{
  grant: {
    clientId: string;
    userId: string;
    consentId: string;
    grantId: string;
  };
}>({
  grant: async ({ isolatedDatabase, protocolRuntime }, use) => {
    const grant = await protocolRuntime.run(() =>
      isolatedDatabase.owner.$transaction(async (db) => {
        const user = await db.user.create({
          data: { email: "grant-reader@example.test" },
        });
        const client = await db.oAuthClient.create({
          data: { clientId: "grant-reader", skipConsent: false },
        });
        const consent = await db.oAuthConsent.create({
          data: {
            userId: user.id,
            clientId: client.clientId,
            scopes: ["profile", "workspace.todo:read"],
          },
        });
        return {
          clientId: client.clientId,
          userId: user.id,
          consentId: consent.id,
          grantId: consent.grantId,
        };
      }),
    );
    await use(grant);
  },
});

describe("live OAuth grant reader", { tags: ["@OAuth/Service"] }, () => {
  test("requires an enabled client and the current user's consent", async ({
    isolatedDatabase: { owner: db },
    protocolRuntime,
    grant,
  }) =>
    protocolRuntime.run(async () => {
      const read = (overrides = {}) =>
        protocolRuntime.request(() =>
          resolveActiveOAuthUserGrant({ ...grant, ...overrides }),
        );
      expect(await read()).toEqual({
        kind: "consent",
        consentId: grant.consentId,
        grantId: grant.grantId,
      });
      expect(await read({ clientId: "missing" })).toBeNull();
      expect(await read({ userId: "missing" })).toBeNull();
      expect(await read({ clientId: "' OR TRUE --" })).toBeNull();
      await db.oAuthClient.update({
        where: { clientId: grant.clientId },
        data: { disabled: true },
      });
      expect(await read()).toBeNull();
      await db.oAuthClient.update({
        where: { clientId: grant.clientId },
        data: { disabled: false, skipConsent: null },
      });
      expect(await read()).toMatchObject({ kind: "consent" });
      await db.oAuthConsent.delete({ where: { id: grant.consentId } });
      expect(await read()).toBeNull();
    }));

  test("checks generation, required binding and every requested scope", async ({
    protocolRuntime,
    grant,
  }) =>
    protocolRuntime.run(async () => {
      const read = (evidence: OAuthUserGrantEvidence) =>
        protocolRuntime.request(() =>
          resolveActiveOAuthUserGrant({ ...grant, ...evidence }),
        );
      expect(
        await read({
          requireGrantBinding: true,
          scopes: ["workspace.todo:read", "profile", "profile"],
        }),
      ).toMatchObject({ kind: "consent" });
      expect(
        await read({ scopes: ["workspace.todo:read", "workspace.todo:write"] }),
      ).toBeNull();
      expect(await read({ scopes: ["' OR TRUE --"] })).toBeNull();
      expect(await read({ grantId: "another-generation" })).toBeNull();
      for (const grantId of [undefined, ""]) {
        expect(await read({ grantId, requireGrantBinding: true })).toBeNull();
        expect(
          await read({ grantId, requireGrantBinding: false, scopes: [] }),
        ).toMatchObject({ kind: "consent" });
      }
    }));

  test("observes trust withdrawal and deleted users on the next read", async ({
    isolatedDatabase: { owner: db },
    protocolRuntime,
    grant,
  }) =>
    protocolRuntime.run(async () => {
      await db.oAuthConsent.delete({ where: { id: grant.consentId } });
      const read = () =>
        protocolRuntime.request(() =>
          resolveActiveOAuthUserGrant({
            ...grant,
            grantId: undefined,
            requireGrantBinding: true,
          }),
        );
      await db.oAuthClient.update({
        where: { clientId: grant.clientId },
        data: { skipConsent: true },
      });
      expect(await read()).toEqual({ kind: "trusted" });
      await db.oAuthClient.update({
        where: { clientId: grant.clientId },
        data: { skipConsent: false },
      });
      expect(await read()).toBeNull();
      await db.oAuthClient.update({
        where: { clientId: grant.clientId },
        data: { skipConsent: true, disabled: true },
      });
      expect(await read()).toBeNull();
      await db.oAuthClient.update({
        where: { clientId: grant.clientId },
        data: { disabled: false },
      });
      expect(await read()).toEqual({ kind: "trusted" });
      await db.user.delete({ where: { id: grant.userId } });
      expect(await read()).toBeNull();
    }));

  test.for(["grantId", "referenceId", "unbound"] as const)(
    "honors trusted replay tombstones for %s",
    async (lineage, {
      isolatedDatabase: { owner: db },
      protocolRuntime,
      grant,
    }) =>
      protocolRuntime.run(async () => {
        await db.oAuthClient.update({
          where: { clientId: grant.clientId },
          data: { skipConsent: true },
        });
        const evidence = {
          ...grant,
          grantId: lineage === "unbound" ? undefined : "trusted-generation",
          requireGrantBinding: true,
        };
        const read = (overrides = {}) =>
          protocolRuntime.request(() =>
            resolveActiveOAuthUserGrant({ ...evidence, ...overrides }),
          );
        const row = await db.oAuthRefreshToken.create({
          data: {
            clientId: grant.clientId,
            userId: grant.userId,
            token: "replay-marker",
            grantId: lineage === "grantId" ? "trusted-generation" : null,
            referenceId:
              lineage === "referenceId" ? "trusted-generation" : null,
            expiresAt: new Date("2020-01-01T00:00:00Z"),
            scopes: [OAUTH_REFRESH_REPLAY_TOMBSTONE_SCOPE],
          },
        });
        // Merely carrying the marker scope without revocation is not a tombstone.
        expect(await read()).toEqual({ kind: "trusted" });
        await db.oAuthRefreshToken.update({
          where: { id: row.id },
          data: { revoked: new Date("2020-01-01T00:00:00Z") },
        });
        expect(await read()).toBeNull();
        if (lineage === "unbound")
          expect(await read({ grantId: "" })).toBeNull();
        expect(await read({ grantId: "different-generation" })).toEqual({
          kind: "trusted",
        });
        // A revoked ordinary token does not represent replay invalidation.
        await db.oAuthRefreshToken.update({
          where: { id: row.id },
          data: { scopes: ["profile"] },
        });
        expect(await read()).toEqual({ kind: "trusted" });
      }),
  );
});
