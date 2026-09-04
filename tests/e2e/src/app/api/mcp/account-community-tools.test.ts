/**
 * MCP seeded tools — 种子工具：账号资料与社区用户
 */

import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { parseTextContent } from "./helpers";
import { closeSeededMcpSession, openSeededMcpSession } from "./seeded-session";

test.describe("/api/mcp - 种子工具覆盖", () => {
  test.describe.configure({ mode: "serial" });

  test("种子工具：账号资料与社区用户", async ({ page, request }) => {
    const session = await openSeededMcpSession(page, request);
    const mcpClient = session.client;
    const currentUser = session.currentUser;

    try {
      const profileResult = await mcpClient.callTool({
        name: "account_profile_get",
        arguments: {},
      });
      const profile = parseTextContent(profileResult) as {
        id?: string;
        email?: string | null;
        name?: string | null;
        username?: string | null;
        isAdmin?: boolean;
        createdAt?: string;
        updatedAt?: string;
      };
      expect(profile.id).toBe(currentUser.id);
      expect(profile.email).toBeNull();
      expect(profile.name).toBe(DEV_SEED.debugName);
      expect(profile.username).toBe(currentUser.username ?? null);
      expect(profile.isAdmin).toBeNull();
      expect(typeof profile.createdAt).toBe("string");
      expect(profile.createdAt).toMatch(/\+08:00$/);
      expect(typeof profile.updatedAt).toBe("string");
      expect(profile.updatedAt).toMatch(/\+08:00$/);

      const publicProfileResult = await mcpClient.callTool({
        name: "community_user_get",
        arguments: { identifier: DEV_SEED.debugUsername, mode: "full" },
      });
      const publicProfile = parseTextContent(publicProfileResult) as {
        found?: boolean;
        user?: {
          id?: string;
          name?: string | null;
          username?: string | null;
          _count?: { comments?: number; uploads?: number };
        };
        sectionCount?: number;
        weeks?: unknown[];
        totalContributions?: number;
      };
      expect(publicProfile.found).toBe(true);
      expect(publicProfile.user?.id).toBe(currentUser.id);
      expect(publicProfile.user?.name).toBe(DEV_SEED.debugName);
      expect(publicProfile.user?.username).toBe(DEV_SEED.debugUsername);
      expect(typeof publicProfile.sectionCount).toBe("number");
      expect(typeof publicProfile.totalContributions).toBe("number");
      expect(Array.isArray(publicProfile.weeks)).toBe(true);
      expect(typeof publicProfile.user?._count?.comments).toBe("number");
      expect(typeof publicProfile.user?._count?.uploads).toBe("number");
    } finally {
      await closeSeededMcpSession(page, session);
    }
  });
});
