import { expect } from "vitest";
import { restSubscriptionTest } from "../shared/rest-subscription-contract-fixture";

restSubscriptionTest(
  "interface-hierarchy.representative-cross-surface-contract-4",
  async ({ subscription: { db, origin, fetch, user }, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const { signResourceBoundOAuthAccessToken } = await import(
        "@/features/oauth/server/device-token-issuer.server"
      );
      const { getCanonicalOAuthIssuer, getOAuthMcpResourceUrl } = await import(
        "@/lib/oauth/resource-urls"
      );
      const owner = await user();
      const other = await user();
      const section = await db.section.findFirstOrThrow({
        where: { retiredAt: null },
      });
      await db.userSectionSubscription.create({
        data: { userId: owner.id, sectionId: section.id },
      });
      const clientId = `subscription-feed-${crypto.randomUUID()}`;
      const subscriptionScope = "workspace.subscription:read";
      const feedScope = "workspace.calendar-feed:read";
      const issuer = getCanonicalOAuthIssuer();
      const client = await db.oAuthClient.create({
        data: {
          clientId,
          name: "Subscription feed disclosure contract",
          tokenEndpointAuthMethod: "none",
          scopes: [subscriptionScope, feedScope],
          consents: {
            create: {
              userId: owner.id,
              scopes: [subscriptionScope, feedScope],
              resources: [issuer, getOAuthMcpResourceUrl()],
            },
          },
        },
        include: { consents: true },
      });
      const current = (headers: HeadersInit) =>
        fetch(`${origin}/api/workspace/subscriptions/current`, { headers });
      expect((await current({})).status).toBe(401);
      for (const principal of [owner, other]) {
        const response = await current({ cookie: principal.cookie });
        expect(response.status).toBe(200);
        const { subscription } = await response.json();
        expect(subscription).toMatchObject({
          userId: principal.id,
          calendarPath: null,
          calendarUrl: null,
        });
        expect(
          subscription.sections.map((item: { id: number }) => item.id),
        ).toEqual(principal.id === owner.id ? [section.id] : []);
      }
      for (const scenario of [
        { scopes: [], resource: issuer, allowed: false, reveal: false },
        {
          scopes: [feedScope],
          resource: issuer,
          allowed: false,
          reveal: false,
        },
        {
          scopes: [subscriptionScope],
          resource: issuer,
          allowed: true,
          reveal: false,
        },
        {
          scopes: [subscriptionScope, feedScope],
          resource: issuer,
          allowed: true,
          reveal: true,
        },
        {
          scopes: [subscriptionScope, feedScope],
          resource: getOAuthMcpResourceUrl(),
          allowed: false,
          reveal: false,
        },
      ]) {
        const token = await signResourceBoundOAuthAccessToken({
          clientId,
          userId: owner.id,
          grantId: client.consents[0].grantId,
          scopes: scenario.scopes,
          resources: [scenario.resource],
          issuedAt: Math.floor(Date.now() / 1000),
          expiresAt: Math.floor(Date.now() / 1000) + 600,
        });
        expect(token).toBeTruthy();
        const response = await current({ authorization: `Bearer ${token}` });
        const body = await response.json();
        if (!scenario.allowed) {
          expect(response.status).toBe(401);
          expect(body.subscription).toBeUndefined();
          continue;
        }
        expect(response.status, JSON.stringify(body)).toBe(200);
        expect(body.subscription.userId).toBe(owner.id);
        expect(
          body.subscription.sections.map((item: { id: number }) => item.id),
        ).toEqual([section.id]);
        if (!scenario.reveal) {
          expect(body.subscription.calendarPath).toBeNull();
          expect(body.subscription.calendarUrl).toBeNull();
          continue;
        }
        const stored = await db.user.findUniqueOrThrow({
          where: { id: owner.id },
        });
        expect(stored.calendarFeedToken).toBeTruthy();
        const feed = new URL(body.subscription.calendarUrl);
        expect(feed.pathname + feed.search).toBe(
          body.subscription.calendarPath,
        );
        expect(body.subscription.calendarPath).toContain(
          stored.calendarFeedToken,
        );
        expect(feed.pathname).not.toBe("/api/workspace/subscriptions/current");
        expect(feed.pathname).toContain("calendar");
      }
    });
  },
);
