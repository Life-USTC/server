/**
 * MCP seeded tools — 种子工具：账号资料与社区用户
 */

import { expect } from "@playwright/test";
import { test } from "./_fixture";
import { parseTextContent } from "./helpers";

test.describe("/api/mcp - 种子工具覆盖", () => {
  test("种子工具：账号资料与社区用户", { tag: "@Account/MCP" }, async ({
    mcpRun,
  }) => {
    await mcpRun(
      {
        calls: [
          ["account_profile_get", "account.profile", "read"],
          ["community_user_get", "community.user", "read"],
        ],
        usage: [
          ["account.profile", 1, 0],
          ["community.user", 1, 0],
        ],
      },
      async ({ mcp: mcpClient, oauth, observeCalendar }) => {
        await observeCalendar([], { calendar: "absent" });
        const currentUser = oauth.user;

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
        expect(profile.name).toBe(currentUser.name);
        expect(profile.username).toBe(currentUser.username ?? null);
        expect(profile.isAdmin).toBeNull();
        expect(typeof profile.createdAt).toBe("string");
        expect(profile.createdAt).toMatch(/\+08:00$/);
        expect(typeof profile.updatedAt).toBe("string");
        expect(profile.updatedAt).toMatch(/\+08:00$/);

        const publicProfileResult = await mcpClient.callTool({
          name: "community_user_get",
          arguments: { identifier: currentUser.username, mode: "full" },
        });
        const publicProfile = parseTextContent(publicProfileResult) as {
          found?: boolean;
          user?: {
            id?: string;
            name?: string | null;
            username?: string | null;
            _count?: { comments?: number; uploads?: number };
          };
          weeks?: unknown[];
          totalContributions?: number;
        };
        expect(publicProfile.found).toBe(true);
        expect(publicProfile.user?.id).toBe(currentUser.id);
        expect(publicProfile.user?.name).toBe(currentUser.name);
        expect(publicProfile.user?.username).toBe(currentUser.username);
        expect(publicProfile).not.toHaveProperty("sectionCount");
        expect(typeof publicProfile.totalContributions).toBe("number");
        expect(Array.isArray(publicProfile.weeks)).toBe(true);
        expect(typeof publicProfile.user?._count?.comments).toBe("number");
        expect(typeof publicProfile.user?._count?.uploads).toBe("number");
        return {
          async verifyState() {
            const db = oauth.worker.database.owner;
            expect(await db.comment.count()).toBe(0);
            expect(await db.upload.count()).toBe(0);
          },
        };
      },
    );
  });
});
