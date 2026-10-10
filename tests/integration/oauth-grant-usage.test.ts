import { describe, expect } from "vitest";
import { listUserOAuthAuthorizations } from "@/features/oauth/server/user-authorizations.server";
import { authPrisma } from "@/lib/db/auth-prisma";
import { recordOAuthGrantUsage } from "@/lib/oauth/grant-usage";
import { oauthUsageTest as test } from "../shared/oauth-usage-fixture";

const anchor = new Date("2026-08-15T10:00:00.000Z");

describe("OAuth authorization usage summary", () => {
  test(
    "汇总当前 grant 最近 30 天的 feature/channel 维度并选择最新使用",
    { tags: ["@OAuth/Service"] },
    async ({ usage, nodeRuntime }) =>
      nodeRuntime.run(async () => {
        const { userId, clientId, grantId } = usage;
        await recordOAuthGrantUsage(
          {
            userId,
            clientId,
            grantId,
            channel: "rest",
            feature: "account.profile",
            action: "read",
            count: 2,
            usedAt: new Date(anchor.getTime() - 1_000),
          },
          authPrisma,
        );
        await recordOAuthGrantUsage(
          {
            userId,
            clientId,
            grantId,
            channel: "graphql",
            feature: "workspace.todo",
            action: "read",
            usedAt: anchor,
          },
          authPrisma,
        );
        await recordOAuthGrantUsage(
          {
            userId,
            clientId,
            grantId,
            channel: "mcp",
            feature: "workspace.todo",
            action: "write",
            outcome: "error",
            usedAt: new Date(anchor.getTime() + 1_000),
          },
          authPrisma,
        );

        const authorizations = await listUserOAuthAuthorizations(
          userId,
          new Date(anchor.getTime() + 2_000),
        );
        expect(authorizations).toHaveLength(1);
        expect(authorizations[0]?.usage).toEqual({
          lastUsedAt: new Date(anchor.getTime() + 1_000).toISOString(),
          lastChannel: "mcp",
          lastFeature: "workspace.todo",
          readCount: 3,
          writeCount: 1,
          errorCount: 1,
        });
      }),
  );

  test(
    "乱序到达的旧请求不会让 lastUsedAt 回退",
    { tags: ["@OAuth/Service"] },
    async ({ isolatedDatabase: { owner: db }, usage, nodeRuntime }) =>
      nodeRuntime.run(async () => {
        const { userId, clientId, grantId } = usage;
        const newer = new Date(anchor.getTime() + 10_000);
        const older = new Date(anchor.getTime() + 5_000);
        const input = {
          userId,
          clientId,
          grantId,
          channel: "rest" as const,
          feature: "account.client-activity",
          action: "read" as const,
        };

        await recordOAuthGrantUsage({ ...input, usedAt: newer }, authPrisma);
        await recordOAuthGrantUsage({ ...input, usedAt: older }, authPrisma);

        const row = await db.oAuthGrantUsageDaily.findUniqueOrThrow({
          where: {
            userId_clientId_grantKey_day_feature_channel: {
              userId,
              clientId,
              grantKey: "grant:usage-grant",
              day: new Date("2026-08-15T00:00:00.000Z"),
              feature: "account.client-activity",
              channel: "rest",
            },
          },
        });
        expect(row.lastUsedAt).toEqual(newer);
        expect(row.readCount).toBe(2);
      }),
  );

  test(
    "客户端已删除时延迟到达的统计写入安全地跳过",
    { tags: ["@OAuth/Service"] },
    async ({ usage, isolatedDatabase: { owner: adminPrisma }, nodeRuntime }) =>
      nodeRuntime.run(async () => {
        const { userId } = usage;
        const deletedClientId = "deleted-usage-client";
        await adminPrisma.oAuthGrantUsageDaily.create({
          data: {
            ...usage,
            grantKey: "grant:usage-grant",
            day: new Date("2026-08-15T00:00:00.000Z"),
            feature: "account.profile",
            channel: "rest",
            readCount: 2,
            lastUsedAt: anchor,
          },
        });
        const before = await adminPrisma.oAuthGrantUsageDaily.findMany();
        await adminPrisma.oAuthClient.create({
          data: {
            clientId: deletedClientId,
            name: "Deleted usage client",
            redirectUris: ["https://deleted-usage.example/callback"],
            skipConsent: false,
          },
        });
        await adminPrisma.oAuthClient.delete({
          where: { clientId: deletedClientId },
        });

        await expect(
          recordOAuthGrantUsage(
            {
              userId,
              clientId: deletedClientId,
              channel: "mcp",
              feature: "account.profile",
              action: "read",
              usedAt: anchor,
            },
            authPrisma,
          ),
        ).resolves.toBe(true);
        await expect(
          adminPrisma.oAuthGrantUsageDaily.count({
            where: { userId, clientId: deletedClientId },
          }),
        ).resolves.toBe(0);
        await expect(
          adminPrisma.oAuthGrantUsageDaily.findMany(),
        ).resolves.toEqual(before);
      }),
  );
});

test("prepared usage excludes other generations and days outside the inclusive thirty-day window", {
  tags: ["@OAuth/Service"],
}, async ({ usage, isolatedDatabase: { owner: db }, nodeRuntime }) => {
  await db.oAuthGrantUsageDaily.createMany({
    data: [
      {
        day: new Date("2026-07-17T00:00:00Z"),
        readCount: 2,
        lastUsedAt: new Date("2026-07-17T09:00:00Z"),
      },
      {
        day: new Date("2026-08-15T00:00:00Z"),
        readCount: 1,
        lastUsedAt: new Date("2026-08-15T09:00:00Z"),
      },
      {
        day: new Date("2026-08-15T00:00:00Z"),
        channel: "mcp" as const,
        feature: "workspace.todo",
        writeCount: 1,
        errorCount: 1,
        lastUsedAt: new Date("2026-08-15T09:01:00Z"),
      },
      {
        day: new Date("2026-07-16T00:00:00Z"),
        readCount: 100,
        lastUsedAt: new Date("2026-07-16T09:00:00Z"),
      },
      {
        day: new Date("2026-08-16T00:00:00Z"),
        readCount: 100,
        lastUsedAt: new Date("2026-08-16T09:00:00Z"),
      },
      {
        day: new Date("2026-08-15T00:00:00Z"),
        grantId: "obsolete",
        grantKey: "grant:obsolete",
        readCount: 100,
        lastUsedAt: new Date("2026-08-15T09:02:00Z"),
      },
    ].map((row) => ({
      ...usage,
      grantKey: "grant:usage-grant",
      channel: "rest" as const,
      feature: "account.profile",
      readCount: 0,
      writeCount: 0,
      errorCount: 0,
      ...row,
    })),
  });
  const before = await db.oAuthGrantUsageDaily.findMany({
    orderBy: { id: "asc" },
  });
  const result = await nodeRuntime.run(() =>
    listUserOAuthAuthorizations(usage.userId, anchor),
  );
  expect(result).toHaveLength(1);
  expect(result[0].usage).toEqual({
    lastUsedAt: "2026-08-15T09:01:00.000Z",
    lastChannel: "mcp",
    lastFeature: "workspace.todo",
    readCount: 3,
    writeCount: 1,
    errorCount: 1,
  });
  await expect(
    db.oAuthGrantUsageDaily.findMany({ orderBy: { id: "asc" } }),
  ).resolves.toEqual(before);
});
