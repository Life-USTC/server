import { expect } from "vitest";
import { listUserOAuthAuthorizations } from "@/features/oauth/server/user-authorizations.server";
import {
  finishOAuthRequestUsage,
  recordOAuthGrantUsage,
  registerOAuthRequestUsage,
  scheduleOAuthGrantUsage,
} from "@/lib/oauth/grant-usage";
import { oauthUsageTest as test } from "../shared/oauth-usage-fixture";

const anchor = new Date("2026-09-27T16:00:00.000Z");

test("oauth.authorization-management.oauth-usage-aggregation", async ({
  usage,
  isolatedDatabase: { owner: db },
  nodeRuntime,
}) => {
  const { userId, clientId } = usage;
  const marker = "usage";
  const base = {
    ...usage,
    feature: "account.profile",
    channel: "rest",
    action: "read",
  } as const;
  await nodeRuntime.run(async () => {
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
  });
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
  await nodeRuntime.run(() =>
    Promise.all(
      Array.from({ length: 10 }, () =>
        recordOAuthGrantUsage({
          ...base,
          feature: "workspace.todo",
          channel: "graphql",
          usedAt: new Date(anchor.getTime() + 30000),
        }),
      ),
    ),
  );
  for (const input of [
    { ...base, grantId: "obsolete-generation", count: 100 },
    { ...base, usedAt: new Date(anchor.getTime() - 31 * 86400000), count: 100 },
    { ...base, usedAt: new Date(anchor.getTime() + 31 * 86400000), count: 100 },
  ])
    await nodeRuntime.run(() => recordOAuthGrantUsage(input));
  const [summary] = await nodeRuntime.run(() =>
    listUserOAuthAuthorizations(userId, new Date(anchor.getTime() + 180000)),
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
  await nodeRuntime.run(() => {
    for (let index = 0; index < 257; index++)
      void scheduleOAuthGrantUsage({
        ...base,
        grantId: `overflow-${marker}-${index}`,
        usedAt: anchor,
      });
  });
  expect(
    await db.oAuthGrantUsageDaily.count({
      where: { clientId, grantId: { startsWith: `overflow-${marker}-` } },
    }),
  ).toBe(257);
});
