import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  listOAuthClientActivity,
  listOwnAccountSecurityActivity,
} from "@/features/settings/server/account-activity";
import { prisma } from "@/lib/db/prisma";
import { createTestPrisma, disconnectTestPrisma } from "../shared/prisma";

const adminPrisma = createTestPrisma(
  process.env.FUNCTION_OWNER_DATABASE_URL ?? process.env.DATABASE_URL,
);

describe.sequential("account activity isolation", () => {
  const marker = crypto.randomUUID();
  const clientId = `activity-client-${marker}`;
  const otherClientId = `activity-other-client-${marker}`;
  const grantId = `activity-grant-${marker}`;
  const otherGrantId = `activity-other-grant-${marker}`;
  let userId = "";
  let otherUserId = "";

  beforeAll(async () => {
    const [user, otherUser] = await Promise.all([
      adminPrisma.user.create({
        data: {
          email: `activity-${marker}@example.test`,
          name: "Activity user",
        },
        select: { id: true },
      }),
      adminPrisma.user.create({
        data: {
          email: `activity-other-${marker}@example.test`,
          name: "Other activity user",
        },
        select: { id: true },
      }),
    ]);
    userId = user.id;
    otherUserId = otherUser.id;

    await adminPrisma.oAuthClient.createMany({
      data: [
        {
          clientId,
          name: "Calendar client",
          redirectUris: ["https://client.example/callback"],
        },
        {
          clientId: otherClientId,
          name: "Other client",
          redirectUris: ["https://other.example/callback"],
        },
      ],
    });

    await adminPrisma.auditLog.createMany({
      data: [
        {
          action: "account_sign_in",
          channel: "auth",
          ipAddress: "203.0.113.42",
          metadata: { rawSecret: "must-never-be-projected" },
          outcome: "success",
          subjectUserId: userId,
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
          userId,
        },
        {
          action: "comment_create",
          channel: "rest",
          ipAddress: "198.51.100.10",
          metadata: { content: "private comment text" },
          oauthClientId: clientId,
          oauthGrantId: grantId,
          outcome: "success",
          sessionId: "session-secret",
          subjectUserId: userId,
          targetId: "comment-1",
          targetType: "comment",
          userAgent: "raw-agent",
          userId,
        },
        {
          action: "comment_create",
          channel: "rest",
          oauthClientId: clientId,
          oauthGrantId: otherGrantId,
          outcome: "success",
          subjectUserId: userId,
          userId,
        },
        {
          action: "comment_create",
          channel: "rest",
          oauthClientId: otherClientId,
          outcome: "success",
          subjectUserId: userId,
          userId,
        },
        {
          action: "comment_create",
          channel: "rest",
          oauthClientId: clientId,
          outcome: "success",
          subjectUserId: otherUserId,
          userId: otherUserId,
        },
      ],
    });
  });

  afterAll(async () => {
    await adminPrisma.auditLog.deleteMany({
      where: { subjectUserId: { in: [userId, otherUserId] } },
    });
    await adminPrisma.oAuthClient.deleteMany({
      where: { clientId: { in: [clientId, otherClientId] } },
    });
    await adminPrisma.user.deleteMany({
      where: { id: { in: [userId, otherUserId] } },
    });
    await Promise.all([
      prisma.$disconnect(),
      disconnectTestPrisma(adminPrisma),
    ]);
  });

  it("本人安全活动只返回账户 allowlist，并对网络和设备脱敏", async () => {
    const activity = await listOwnAccountSecurityActivity(userId);

    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      action: "account_sign_in",
      network: "203.0.113.*",
      device: "Chrome · Windows",
    });
    expect(activity[0]).not.toHaveProperty("metadata");
    expect(activity[0]).not.toHaveProperty("ipAddress");
    expect(activity[0]).not.toHaveProperty("userAgent");
  });

  it("OAuth 客户端只能看到自身代表当前用户产生的安全投影", async () => {
    const activity = await listOAuthClientActivity({
      userId,
      clientId,
      grantId,
    });

    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      action: "comment_create",
      channel: "rest",
      targetType: "comment",
    });
    expect(activity[0]).not.toHaveProperty("metadata");
    expect(activity[0]).not.toHaveProperty("targetId");
    expect(activity[0]).not.toHaveProperty("oauthGrantId");
    expect(activity[0]).not.toHaveProperty("sessionId");
    expect(activity[0]).not.toHaveProperty("ipAddress");
    expect(activity[0]).not.toHaveProperty("userAgent");
  });
});
