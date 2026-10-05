/**
 * E2E tests for GET /api/community/users/[identifier].
 *
 * Public profile endpoint mirroring /u/[username] and /u/id/[uid].
 */
import { expect } from "@playwright/test";
import { authAccounts, test } from "../../_harness/auth";

const BASE = "/api/community/users";

test.describe("GET /api/community/users/[identifier]", () => {
  test("契约", { tag: "@User/REST" }, async ({
    run,
    request,
    account: _account,
  }) => {
    await run(async () => {
      const response = await request.get(
        `/api/community/users/${authAccounts.user.username}`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        user?: {
          id?: string;
          name?: string | null;
          username?: string | null;
          _count?: {
            comments?: number;
            homeworksCreated?: number;
            uploads?: number;
          };
        };
        totalContributions?: number;
        weeks?: unknown[];
      };
      expect(body.user?.id).toBeTruthy();
      expect(body.user?.name).toBe(authAccounts.user.name);
      expect(body.user?.username).toBe(authAccounts.user.username);
      expect(body).not.toHaveProperty("sectionCount");
      expect(body.user?._count).not.toHaveProperty("subscribedSections");
      expect(typeof body.totalContributions).toBe("number");
      expect(Array.isArray(body.weeks)).toBe(true);
      expect(typeof body.user?._count?.comments).toBe("number");
      expect(typeof body.user?._count?.uploads).toBe("number");
      expect(typeof body.user?._count?.homeworksCreated).toBe("number");
    });
  });

  test("按用户名返回公开资料", { tag: "@User/REST" }, async ({
    run,
    request,
    account: _account,
  }) => {
    await run(async () => {
      const response = await request.get(
        `${BASE}/${authAccounts.user.username}`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        user?: {
          id?: string;
          name?: string | null;
          username?: string | null;
          _count?: { comments?: number; uploads?: number };
        };
        weeks?: Array<Array<{ date?: string; count?: number }>>;
        totalContributions?: number;
      };

      expect(body.user?.name).toBe(authAccounts.user.name);
      expect(body.user?.username).toBe(authAccounts.user.username);
      expect(body).not.toHaveProperty("sectionCount");
      expect(body.user?._count).not.toHaveProperty("subscribedSections");
      expect(typeof body.user?._count?.comments).toBe("number");
      expect(typeof body.user?._count?.uploads).toBe("number");
      expect((body.weeks?.length ?? 0) > 0).toBe(true);
      expect(body.weeks?.[0]?.[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof body.totalContributions).toBe("number");
    });
  });

  test("按 userId 返回同一用户", { tag: "@User/REST" }, async ({
    run,
    request,
    account: _account,
  }) => {
    await run(async () => {
      const byUsername = await request.get(
        `${BASE}/${authAccounts.user.username}`,
      );
      expect(byUsername.status()).toBe(200);
      const usernameBody = (await byUsername.json()) as {
        user?: { id?: string; username?: string | null };
      };
      expect(usernameBody.user?.id).toBeTruthy();

      const byId = await request.get(`${BASE}/${usernameBody.user?.id}`);
      expect(byId.status()).toBe(200);
      const idBody = (await byId.json()) as {
        user?: { id?: string; username?: string | null };
      };

      expect(idBody.user?.id).toBe(usernameBody.user?.id);
      expect(idBody.user?.username).toBe(authAccounts.user.username);
    });
  });

  test("缺失用户返回 404", { tag: "@User/REST" }, async ({ run, request }) => {
    await run(async () => {
      const response = await request.get(`${BASE}/missing-e2e-user`);
      expect(response.status()).toBe(404);
    });
  });
});
