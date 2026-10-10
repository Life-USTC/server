import { describe, expect } from "vitest";
import {
  listOAuthClientActivity,
  listOwnAccountSecurityActivity,
} from "@/features/settings/server/account-activity";
import { isolatedNodeTest } from "../shared/isolated-node-fixture";

const test = isolatedNodeTest.extend<{
  activityIdentity: { userId: string; clientId: string; grantId: string };
}>({
  activityIdentity: async (
    { isolatedDatabase: { owner }, nodeRuntime },
    use,
  ) => {
    const clientId = "activity-client";
    const otherClientId = "activity-other-client";
    const grantId = "activity-grant";
    const otherGrantId = "activity-other-grant";
    const userId = "activity-user";
    const otherUserId = "activity-other-user";
    await nodeRuntime.run(() =>
      owner.$transaction(async (fixturePrisma) => {
        await fixturePrisma.user.createMany({
          data: [
            {
              id: userId,
              email: "activity@example.test",
              name: "Activity user",
            },
            {
              id: otherUserId,
              email: "activity-other@example.test",
              name: "Other activity user",
            },
          ],
        });

        await fixturePrisma.oAuthClient.createMany({
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

        await fixturePrisma.auditLog.createMany({
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
      }),
    );
    await use({ userId, clientId, grantId });
  },
});

describe("account activity isolation", () => {
  test("本人安全活动只返回账户 allowlist，并对网络和设备脱敏", {
    tags: ["@Account/Service"],
  }, async ({ activityIdentity, nodeRuntime }) => {
    const { userId } = activityIdentity;
    const activity = await nodeRuntime.run(() =>
      listOwnAccountSecurityActivity(userId),
    );

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

  test("OAuth 客户端只能看到自身代表当前用户产生的安全投影", {
    tags: ["@Account/Service"],
  }, async ({ activityIdentity, nodeRuntime }) => {
    const { userId, clientId, grantId } = activityIdentity;
    const activity = await nodeRuntime.run(() =>
      listOAuthClientActivity({
        userId,
        clientId,
        grantId,
      }),
    );

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
