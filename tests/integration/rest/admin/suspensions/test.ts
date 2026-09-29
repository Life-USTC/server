/**
 * E2E tests for GET/POST /api/admin/suspensions
 *
 * Admin-only endpoint for listing and creating user suspensions.
 *
 * - GET returns `{ data: [...] }` with user info, ordered by createdAt desc
 * - POST creates a new suspension and closes any previous open suspension for the user
 * - POST body: userId (required), reason, note, expiresAt
 * - POST returns 404 if the target user does not exist
 * - POST returns 400 for invalid request body
 * - Both methods return 401 for unauthenticated or non-admin requests
 */
import { expect } from "@playwright/test";
import { assertApiContract } from "../../_shared/api-contract";
import { base as BASE, test } from "./_fixture";

test.describe("GET/POST /api/admin/suspensions 封禁管理", () => {
  test("API 契约", async ({ request, run }) =>
    run(async () => {
      await assertApiContract(request, { routePath: BASE });
    }));
  test("未认证 GET 返回 401", async ({ request, run }) =>
    run(async () => {
      expect((await request.get(BASE)).status()).toBe(401);
    }));
  test("未认证 POST 返回 401", async ({ request, run }) =>
    run(async () => {
      expect(
        (
          await request.post(BASE, {
            data: { userId: "fake-id", reason: "test" },
          })
        ).status(),
      ).toBe(401);
    }));
  test("非管理员 GET 返回 401", async ({ suspensionState, run }) =>
    run(async () => {
      const { ordinary, db } = suspensionState;
      expect((await ordinary.request.get(BASE)).status()).toBe(401);
      expect(await db.auditLog.count()).toBe(0);
    }));
  test("管理员可列出封禁并找到 seed 记录", async ({ suspensionState, run }) =>
    run(async () => {
      const { admin, known, historical, knownUser, db } = suspensionState;
      const response = await admin.request.get(BASE);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data.map((row: { id: string }) => row.id)).toEqual([
        known.id,
        historical.id,
      ]);
      expect(body.data[0]).toMatchObject({
        reason: "Known suspension record",
        userId: knownUser.id,
        liftedAt: null,
        user: { id: knownUser.id },
      });
      expect(await db.auditLog.count()).toBe(0);
    }));
  test("POST 不存在的 userId 返回 404", async ({ suspensionState, run }) =>
    run(async () => {
      const { admin, db } = suspensionState;
      const before = await db.userSuspension.findMany({
        orderBy: { id: "asc" },
      });
      const response = await admin.request.post(BASE, {
        data: { userId: "nonexistent-user-id-e2e", reason: "should fail" },
      });
      expect(response.status()).toBe(404);
      expect(
        await db.userSuspension.findMany({ orderBy: { id: "asc" } }),
      ).toEqual(before);
      expect(await db.auditLog.count()).toBe(0);
    }));
  test("POST 无效 expiresAt 返回 400 且不创建封禁", async ({
    suspensionState,
    run,
  }) =>
    run(async () => {
      const { admin, target, db } = suspensionState;
      const before = await db.userSuspension.findMany({
        orderBy: { id: "asc" },
      });
      for (const expiresAt of [
        "not-a-date",
        "2026-02-31",
        "2026/02/31",
        "2026.02.31",
        "02/31/2026",
        "February 31, 2026",
      ]) {
        const response = await admin.request.post(BASE, {
          data: {
            userId: target.id,
            reason: "invalid expiration should fail",
            expiresAt,
          },
        });
        expect(response.status()).toBe(400);
      }
      const list = await admin.request.get(BASE);
      expect(list.status()).toBe(200);
      expect(
        (await list.json()).data.some(
          (row: { userId: string }) => row.userId === target.id,
        ),
      ).toBe(false);
      expect(
        await db.userSuspension.findMany({ orderBy: { id: "asc" } }),
      ).toEqual(before);
      expect(await db.auditLog.count()).toBe(0);
    }));
  test("openapi.suspension-created-status", async ({ suspensionState, run }) =>
    run(async () => {
      const { admin, target, known, historical, db } = suspensionState;
      const response = await admin.request.post(BASE, {
        data: {
          userId: target.id,
          reason: "e2e suspension test",
          note: "automated test",
        },
      });
      expect(response.status()).toBe(201);
      const first = (await response.json()).suspension;
      expect(response.headers().location).toBe(`${BASE}/${first.id}`);
      expect(first).toMatchObject({
        userId: target.id,
        reason: "e2e suspension test",
        expiresAt: null,
      });
      expect(
        await db.userSuspension.findUniqueOrThrow({ where: { id: first.id } }),
      ).toMatchObject({
        userId: target.id,
        createdById: admin.id,
        reason: "e2e suspension test",
        note: "automated test",
        expiresAt: null,
        liftedAt: null,
      });
      expect(await db.auditLog.findMany()).toEqual([
        expect.objectContaining({
          action: "admin_user_suspend",
          userId: admin.id,
          subjectUserId: target.id,
          targetType: "user",
          targetId: target.id,
          channel: "rest",
          metadata: { reasonProvided: true },
        }),
      ]);

      const replacementResponse = await admin.request.post(BASE, {
        data: { userId: target.id, reason: "e2e suspension replacement" },
      });
      expect(replacementResponse.status()).toBe(201);
      const replacement = (await replacementResponse.json()).suspension;
      expect(replacement).toMatchObject({
        userId: target.id,
        reason: "e2e suspension replacement",
      });
      expect(replacement.id).not.toBe(first.id);
      expect(replacementResponse.headers().location).toBe(
        `${BASE}/${replacement.id}`,
      );
      const listResponse = await admin.request.get(BASE);
      expect(listResponse.status()).toBe(200);
      const userSuspensions = (await listResponse.json()).data.filter(
        (row: { userId: string }) => row.userId === target.id,
      );
      expect(
        userSuspensions.filter(
          (row: { liftedAt: string | null }) => row.liftedAt === null,
        ),
      ).toHaveLength(1);
      expect(
        userSuspensions.some(
          (row: { id: string; liftedAt: string | null }) =>
            row.id === first.id && row.liftedAt !== null,
        ),
      ).toBe(true);
      expect(
        await db.userSuspension.findUniqueOrThrow({ where: { id: first.id } }),
      ).toMatchObject({ liftedAt: expect.any(Date), liftedById: admin.id });
      expect(
        await db.userSuspension.findMany({
          where: { userId: target.id, liftedAt: null },
        }),
      ).toEqual([
        expect.objectContaining({
          id: replacement.id,
          createdById: admin.id,
          reason: "e2e suspension replacement",
          note: null,
          expiresAt: null,
        }),
      ]);
      const audits = await db.auditLog.findMany();
      expect(audits).toHaveLength(2);
      for (const audit of audits)
        expect(audit).toMatchObject({
          action: "admin_user_suspend",
          userId: admin.id,
          subjectUserId: target.id,
          targetId: target.id,
          targetType: "user",
          channel: "rest",
          metadata: { reasonProvided: true },
        });
      for (const row of [known, historical])
        expect(
          await db.userSuspension.findUniqueOrThrow({ where: { id: row.id } }),
        ).toEqual(row);
    }));
});
