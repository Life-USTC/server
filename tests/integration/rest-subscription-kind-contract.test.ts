import { createServer, type Server } from "node:http";
import { getRequest, setResponse } from "@sveltejs/kit/node";
import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { getCurrentCalendarSubscriptionRoute } from "@/lib/api/routes/calendar-subscriptions";
import { patchSubscriptionKindRoute } from "@/lib/api/routes/subscription-kind-route";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma } from "@/lib/db/prisma";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const users: string[] = [];
let origin: string;
let server: Server;
beforeAll(async () => {
  server = createServer(async (incoming, outgoing) => {
    try {
      const request = await getRequest({ request: incoming, base: origin });
      await setResponse(
        outgoing,
        request.method === "PATCH"
          ? await patchSubscriptionKindRoute(
              request,
              new URL(request.url).pathname.split("/").at(-1),
            )
          : await getCurrentCalendarSubscriptionRoute(request),
      );
    } catch {
      outgoing.statusCode = 500;
      outgoing.end("Request failed");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing address");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: users } } });
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await Promise.all([
    db.$disconnect(),
    authPrisma.$disconnect(),
    prisma.$disconnect(),
  ]);
});
async function user() {
  const row = await db.user.create({
    data: { email: `${crypto.randomUUID()}@subscription-contract.test` },
  });
  users.push(row.id);
  const token = crypto.randomUUID();
  await db.session.create({
    data: {
      userId: row.id,
      sessionToken: token,
      expires: new Date(Date.now() + 3600_000),
    },
  });
  const context = await getBetterAuthInstance().$context;
  return {
    id: row.id,
    cookie: `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`,
  };
}
it("openapi.subscription-kind", async () => {
  const owner = await user();
  const other = await user();
  const section = await db.section.findFirstOrThrow({
    where: { retiredAt: null },
  });
  await db.userSectionSubscription.create({
    data: { userId: owner.id, sectionId: section.id, kind: "regular" },
  });
  const patch = (cookie: string, kind: string) =>
    fetch(`${origin}/api/workspace/subscriptions/${section.jwId}`, {
      method: "PATCH",
      headers: { cookie, origin, "content-type": "application/json" },
      body: JSON.stringify({ kind }),
    });
  const absent = await patch(other.cookie, "auditor");
  expect(absent.status).toBe(404);
  expect(await absent.json()).toEqual({ error: "Subscription not found" });
  for (const kind of ["auditor", "teaching_assistant", "regular"]) {
    const response = await patch(owner.cookie, kind);
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toEqual({ sectionJwId: section.jwId, kind });
    const current = await fetch(
      `${origin}/api/workspace/subscriptions/current`,
      { headers: { cookie: owner.cookie } },
    );
    expect(current.status).toBe(200);
    expect((await current.json()).subscription.sections).toMatchObject([
      { jwId: section.jwId, kind },
    ]);
    expect(
      await db.userSectionSubscription.findMany({
        where: { sectionId: section.id, userId: { in: users } },
      }),
    ).toMatchObject([{ userId: owner.id, kind }]);
  }
});

it("interface-hierarchy.representative-cross-surface-contract-4", async () => {
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
  try {
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
      { scopes: [feedScope], resource: issuer, allowed: false, reveal: false },
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
      expect(feed.pathname + feed.search).toBe(body.subscription.calendarPath);
      expect(body.subscription.calendarPath).toContain(
        stored.calendarFeedToken,
      );
      expect(feed.pathname).not.toBe("/api/workspace/subscriptions/current");
      expect(feed.pathname).toContain("calendar");
    }
  } finally {
    await db.oAuthClient.delete({ where: { clientId } });
  }
});
