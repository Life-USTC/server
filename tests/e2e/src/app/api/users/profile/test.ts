/**
 * E2E tests for GET /api/community/users/[identifier].
 *
 * Public profile endpoint mirroring /u/[username] and /u/id/[uid].
 */
import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../../utils/dev-seed";
import { assertApiContract } from "../../../_shared/api-contract";

const BASE = "/api/community/users";

test.describe("GET /api/community/users/[identifier]", () => {
  test("契约", async ({ request }) => {
    await assertApiContract(request, {
      routePath: "/api/community/users/[identifier]",
    });
  });

  test("按用户名返回公开资料", async ({ request }) => {
    const response = await request.get(`${BASE}/${DEV_SEED.debugUsername}`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      user?: {
        id?: string;
        name?: string | null;
        username?: string | null;
        _count?: { comments?: number; uploads?: number };
      };
      sectionCount?: number;
      weeks?: Array<Array<{ date?: string; count?: number }>>;
      totalContributions?: number;
    };

    expect(body.user?.name).toBe(DEV_SEED.debugName);
    expect(body.user?.username).toBe(DEV_SEED.debugUsername);
    expect(typeof body.sectionCount).toBe("number");
    expect(typeof body.user?._count?.comments).toBe("number");
    expect(typeof body.user?._count?.uploads).toBe("number");
    expect((body.weeks?.length ?? 0) > 0).toBe(true);
    expect(body.weeks?.[0]?.[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof body.totalContributions).toBe("number");
  });

  test("按 userId 返回同一用户", async ({ request }) => {
    const byUsername = await request.get(`${BASE}/${DEV_SEED.debugUsername}`);
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
    expect(idBody.user?.username).toBe(DEV_SEED.debugUsername);
  });

  test("缺失用户返回 404", async ({ request }) => {
    const response = await request.get(`${BASE}/missing-e2e-user`);
    expect(response.status()).toBe(404);
  });
});
