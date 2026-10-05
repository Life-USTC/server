/**
 * E2E tests for GET /api/admin/users
 *
 * Admin-only endpoint that returns a paginated list of users.
 *
 * - GET returns `{ data, pagination }` with user objects
 *   containing id, name, username, isAdmin, email, createdAt
 * - Supports `search` query for filtering by id, name, username, or email
 * - Supports `page` and `pageSize` pagination parameters (max 100; retired `limit` is rejected)
 * - Returns 401 for unauthenticated or non-admin requests
 * - Returns 400 for invalid query parameters
 */
import { expect } from "@playwright/test";
import { assertApiContract } from "../../_shared/api-contract";
import { test } from "./_fixture";

const BASE = "/api/admin/users";

test.describe("GET /api/admin/users 用户列表", () => {
  test("API 契约", { tag: "@Admin/REST" }, async ({ request, run }) =>
    run(async () => {
      await assertApiContract(request, { routePath: BASE });
    }),
  );

  test("未认证请求返回 401", { tag: "@Admin/REST" }, async ({ request, run }) =>
    run(async () => {
      const response = await request.get(BASE);
      expect(response.status()).toBe(401);
    }),
  );

  test(
    "非管理员认证用户返回 401",
    { tag: "@Admin/REST" },
    async ({ userState, run }) =>
      run(async () => {
        const {
          owner: { request },
          db,
        } = userState;
        const response = await request.get(BASE);
        expect(response.status()).toBe(401);
        expect(await db.auditLog.count()).toBe(0);
      }),
  );

  test(
    "管理员可按用户名搜索 seed 用户",
    { tag: "@Admin/REST" },
    async ({ userState, run }) =>
      run(async () => {
        const {
          admin: { request },
          ownerUser,
        } = userState;
        const response = await request.get(
          `${BASE}?search=${ownerUser.username}`,
        );
        expect(response.status()).toBe(200);
        const body = (await response.json()) as {
          data?: Array<{
            id?: string;
            username?: string | null;
            isAdmin?: boolean;
          }>;
          pagination?: {
            total: number;
            page: number;
            pageSize: number;
            totalPages: number;
          };
        };
        expect(
          body.data?.some((item) => item.username === ownerUser.username),
        ).toBe(true);
        expect(body.pagination).toBeDefined();
        expect(typeof body.pagination?.total).toBe("number");
        expect(body.pagination?.total).toBe(1);
        expect(body.data).toEqual([
          expect.objectContaining({
            id: ownerUser.id,
            username: "private-user",
            isAdmin: false,
          }),
        ]);
        expect(await userState.db.auditLog.count()).toBe(0);
      }),
  );

  test(
    "管理员可使用 pageSize=1 分页用户",
    { tag: "@Admin/REST" },
    async ({ userState, run }) =>
      run(async () => {
        const {
          admin: { request },
          ownerUser,
        } = userState;
        const response = await request.get(`${BASE}?page=1&pageSize=1`);
        expect(response.status()).toBe(200);
        const body = (await response.json()) as {
          data?: unknown[];
          pagination?: { page: number; pageSize: number; totalPages: number };
        };
        expect(body.data?.length).toBe(1);
        expect(body.pagination?.page).toBe(1);
        expect(body.pagination?.pageSize).toBe(1);
        expect(body.data).toEqual([
          expect.objectContaining({ id: ownerUser.id }),
        ]);
        expect(body.pagination).toMatchObject({ total: 2, totalPages: 2 });
        const second = await request.get(`${BASE}?page=2&pageSize=1`);
        expect(second.status()).toBe(200);
        expect((await second.json()).data).toEqual([
          expect.objectContaining({ id: userState.admin.id }),
        ]);
      }),
  );
});
