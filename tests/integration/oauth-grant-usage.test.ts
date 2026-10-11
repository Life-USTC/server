import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listUserOAuthAuthorizations } from "@/features/oauth/server/user-authorizations.server";
import { authPrisma } from "@/lib/db/auth-prisma";
import {
  oauthGrantUsageKey,
  recordOAuthGrantUsage,
} from "@/lib/oauth/grant-usage";
import { createFixturePrisma, disconnectTestPrisma } from "../shared/prisma";

const adminPrisma = createFixturePrisma();

describe("OAuth authorization usage summary", { concurrent: false }, () => {
  const marker = crypto.randomUUID();
  const clientId = `usage-client-${marker}`;
  const grantId = `usage-grant-${marker}`;
  const anchor = new Date("2026-08-15T10:00:00.000Z");
  let userId = "";

  beforeAll(async () => {
    const user = await adminPrisma.user.create({
      data: {
        email: `usage-${marker}@example.test`,
        name: "Usage summary user",
      },
      select: { id: true },
    });
    userId = user.id;
    await adminPrisma.oAuthClient.create({
      data: {
        clientId,
        name: "Usage client",
        redirectUris: ["https://usage.example/callback"],
        skipConsent: false,
      },
    });
    await adminPrisma.oAuthConsent.create({
      data: {
        clientId,
        userId,
        grantId,
        scopes: ["account.profile:read", "workspace.todo:write"],
      },
    });
  });

  afterAll(async () => {
    await adminPrisma.oAuthClient.deleteMany({ where: { clientId } });
    await adminPrisma.user.deleteMany({ where: { id: userId } });
    await Promise.all([
      authPrisma.$disconnect(),
      disconnectTestPrisma(adminPrisma),
    ]);
  });

  it("汇总当前 grant 最近 30 天的 feature/channel 维度并选择最新使用", async () => {
    await recordOAuthGrantUsage({
      userId,
      clientId,
      grantId,
      channel: "rest",
      feature: "account.profile",
      action: "read",
      count: 2,
      usedAt: new Date(anchor.getTime() - 1_000),
    });
    await recordOAuthGrantUsage({
      userId,
      clientId,
      grantId,
      channel: "graphql",
      feature: "workspace.todo",
      action: "read",
      usedAt: anchor,
    });
    await recordOAuthGrantUsage({
      userId,
      clientId,
      grantId,
      channel: "mcp",
      feature: "workspace.todo",
      action: "write",
      outcome: "error",
      usedAt: new Date(anchor.getTime() + 1_000),
    });

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
  });

  it("乱序到达的旧请求不会让 lastUsedAt 回退", async () => {
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

    await recordOAuthGrantUsage({ ...input, usedAt: newer });
    await recordOAuthGrantUsage({ ...input, usedAt: older });

    const row = await authPrisma.oAuthGrantUsageDaily.findUniqueOrThrow({
      where: {
        userId_clientId_grantKey_day_feature_channel: {
          userId,
          clientId,
          grantKey: oauthGrantUsageKey(grantId),
          day: new Date("2026-08-15T00:00:00.000Z"),
          feature: "account.client-activity",
          channel: "rest",
        },
      },
    });
    expect(row.lastUsedAt).toEqual(newer);
    expect(row.readCount).toBe(2);
  });

  it("客户端已删除时延迟到达的统计写入安全地跳过", async () => {
    const deletedClientId = `deleted-usage-client-${marker}`;
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
      recordOAuthGrantUsage({
        userId,
        clientId: deletedClientId,
        channel: "mcp",
        feature: "account.profile",
        action: "read",
        usedAt: anchor,
      }),
    ).resolves.toBe(true);
    await expect(
      authPrisma.oAuthGrantUsageDaily.count({
        where: { userId, clientId: deletedClientId },
      }),
    ).resolves.toBe(0);
  });

  it("keeps SQL-looking dimensions as bound values and skips a deleted user", async () => {
    const feature = `profile'); DROP TABLE "OAuthGrantUsageDaily"; --`;
    await recordOAuthGrantUsage({
      userId,
      clientId,
      grantId,
      feature,
      channel: "graphql",
      action: "write",
      count: 3,
      outcome: "error",
      usedAt: anchor,
    });
    expect(
      await adminPrisma.oAuthGrantUsageDaily.findFirst({
        where: { userId, clientId, feature },
      }),
    ).toMatchObject({ feature, writeCount: 3, readCount: 0, errorCount: 3 });
    const missingUserId = `deleted-usage-user-${marker}`;
    await adminPrisma.user.create({
      data: { id: missingUserId, email: `${missingUserId}@example.test` },
    });
    await adminPrisma.user.delete({ where: { id: missingUserId } });
    await expect(
      recordOAuthGrantUsage({
        userId: missingUserId,
        clientId,
        feature,
        channel: "rest",
        action: "read",
        usedAt: anchor,
      }),
    ).resolves.toBe(true);
    expect(
      await adminPrisma.oAuthGrantUsageDaily.count({
        where: { userId: missingUserId, clientId },
      }),
    ).toBe(0);
  });

  it("rejects non-finite and overflowing counts without persisting a row", async () => {
    const feature = "invalid-count";
    for (const count of [Number.NaN, Number.POSITIVE_INFINITY, 2 ** 31]) {
      await expect(
        recordOAuthGrantUsage({
          userId,
          clientId,
          grantId,
          feature,
          channel: "rest",
          action: "read",
          count,
          usedAt: anchor,
        }),
      ).rejects.toThrow();
    }
    expect(
      await adminPrisma.oAuthGrantUsageDaily.count({
        where: { userId, clientId, feature },
      }),
    ).toBe(0);
  });
});
