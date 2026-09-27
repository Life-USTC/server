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
