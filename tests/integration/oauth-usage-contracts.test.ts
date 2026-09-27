import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { listUserOAuthAuthorizations } from "@/features/oauth/server/user-authorizations.server";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import {
  finishOAuthRequestUsage,
  recordOAuthGrantUsage,
  registerOAuthRequestUsage,
  scheduleOAuthGrantUsage,
} from "@/lib/oauth/grant-usage";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const userId = `usage-contract-${marker}`;
const clientId = `usage-contract-client-${marker}`;
const grantId = `usage-contract-grant-${marker}`;
const anchor = new Date("2026-09-27T16:00:00.000Z");
const authUrl = process.env.AUTH_DATABASE_URL;
if (!authUrl) throw new Error("Expected production authentication role URL");
const runtimeEnv = { HYPERDRIVE_AUTH: { connectionString: authUrl } };
const base = {
  userId,
  clientId,
  grantId,
  feature: "account.profile",
  channel: "rest",
  action: "read",
} as const;
beforeAll(async () => {
  await db.user.create({
    data: { id: userId, email: `${userId}@example.test` },
  });
  await db.oAuthClient.create({
    data: { clientId, name: marker, skipConsent: false },
  });
  await db.oAuthConsent.create({
    data: { clientId, userId, grantId, scopes: ["account.profile:read"] },
  });
});
afterAll(async () => {
  vi.restoreAllMocks();
  await db.oAuthClient.deleteMany({ where: { clientId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
});

it("oauth.authorization-management.oauth-usage-aggregation", async () => {
  const scheduled: Promise<unknown>[] = [];
  await runWithCloudflareRuntimeEnv(
    runtimeEnv,
    async () => {
      for (const [offset, count] of [
        [-1, 1],
        [1, 1],
        [60000, 3],
        [1000, 1],
      ]) {
        const request = new Request(
          "https://life.example/private-target?query=private-search",
          {
            headers: {
              authorization: "Bearer private-token",
              cookie: "private-cookie",
            },
          },
        );
        const input = {
          ...base,
          usedAt: new Date(anchor.getTime() + offset),
          count,
        };
        registerOAuthRequestUsage(request, input);
        registerOAuthRequestUsage(request, input);
        await finishOAuthRequestUsage(request, 200);
      }
      const failed = new Request("https://life.example/private-write");
      registerOAuthRequestUsage(failed, {
        ...base,
        channel: "mcp",
        feature: "workspace.todo",
        action: "write",
        usedAt: new Date(anchor.getTime() + 120000),
      });
      await finishOAuthRequestUsage(failed, 403);
    },
    {
      waitUntil(task: Promise<unknown>) {
        scheduled.push(task);
      },
    },
  );
  await Promise.all(scheduled);
  const rows = await db.oAuthGrantUsageDaily.findMany({
    where: { clientId, channel: "rest" },
    orderBy: { day: "asc" },
  });
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    day: new Date("2026-09-27T00:00:00.000Z"),
    readCount: 1,
    lastUsedAt: new Date(anchor.getTime() - 1),
  });
  expect(rows[1]).toMatchObject({
    day: new Date("2026-09-28T00:00:00.000Z"),
    readCount: 5,
    lastUsedAt: new Date(anchor.getTime() + 60000),
  });
  await Promise.all(
    Array.from({ length: 10 }, () =>
      recordOAuthGrantUsage({
        ...base,
        feature: "workspace.todo",
        channel: "graphql",
        usedAt: new Date(anchor.getTime() + 30000),
      }),
    ),
  );
  for (const input of [
    { ...base, grantId: "obsolete-generation", count: 100 },
    { ...base, usedAt: new Date(anchor.getTime() - 31 * 86400000), count: 100 },
    { ...base, usedAt: new Date(anchor.getTime() + 31 * 86400000), count: 100 },
  ])
    await recordOAuthGrantUsage(input);
  const [summary] = await listUserOAuthAuthorizations(
    userId,
    new Date(anchor.getTime() + 180000),
  );
  expect(summary.usage).toEqual({
    lastUsedAt: new Date(anchor.getTime() + 120000).toISOString(),
    lastChannel: "mcp",
    lastFeature: "workspace.todo",
    readCount: 16,
    writeCount: 1,
    errorCount: 1,
  });
  const all = await db.oAuthGrantUsageDaily.findMany({ where: { clientId } });
  expect(JSON.stringify(all)).not.toMatch(
    /private-|requestId|userAgent|ipAddress|accessToken|clientSecret/,
  );

  // New dimensions beyond the bounded coalescing map persist as singleton batches.
  const overflowTasks: Promise<unknown>[] = [];
  await runWithCloudflareRuntimeEnv(
    runtimeEnv,
    () => {
      for (let index = 0; index < 257; index++)
        void scheduleOAuthGrantUsage({
          ...base,
          grantId: `overflow-${marker}-${index}`,
          usedAt: anchor,
        });
    },
    {
      waitUntil(task: Promise<unknown>) {
        overflowTasks.push(task);
      },
    },
  );
  await Promise.all(overflowTasks);
  expect(
    await db.oAuthGrantUsageDaily.count({
      where: { clientId, grantId: { startsWith: `overflow-${marker}-` } },
    }),
  ).toBe(257);
});
