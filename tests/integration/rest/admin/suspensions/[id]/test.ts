/**
 * E2E tests for PATCH /api/admin/suspensions/[id]
 *
 * Admin-only endpoint to lift (un-suspend) a single suspension.
 *
 * - PATCH sets liftedAt and liftedById on the suspension record and clears the user's open suspension state
 * - No request body is needed
 * - Returns the updated suspension in `{ suspension: {...} }`
 * - Returns 401 for unauthenticated or non-admin requests
 * - Returns 400 for invalid suspension ID
 */
import { expect } from "@playwright/test";
import { assertApiContract } from "../../../_shared/api-contract";
import { base as BASE, test } from "../_fixture";

test.describe("PATCH /api/admin/suspensions/[id] 解除封禁", () => {
  test("API 契约", async ({ request }) => {
    await assertApiContract(request, { routePath: `${BASE}/[id]` });
  });
  test("未认证 PATCH 返回 401", async ({ request }) => {
    expect((await request.patch(`${BASE}/nonexistent-id`)).status()).toBe(401);
  });
  test("非管理员 PATCH 返回 401", async ({ suspensionState }) => {
    const { ordinary, known, db } = suspensionState;
    expect((await ordinary.request.patch(`${BASE}/${known.id}`)).status()).toBe(
      401,
    );
    expect(
      await db.userSuspension.findUniqueOrThrow({ where: { id: known.id } }),
    ).toEqual(known);
    expect(await db.auditLog.count()).toBe(0);
  });
  test("管理员可解除临时封禁", async ({ suspensionState }) => {
    const { admin, target, known, db } = suspensionState;
    const created = await admin.request.post(BASE, {
      data: { userId: target.id, reason: "e2e-lift-suspension" },
    });
    expect(created.status()).toBe(201);
    const id = (await created.json()).suspension.id;
    expect(id).toBeTruthy();
    const response = await admin.request.patch(`${BASE}/${id}`);
    expect(response.status()).toBe(200);
    const body = (await response.json()).suspension;
    expect(body.id).toBe(id);
    expect(body.liftedAt).toBeTruthy();
    expect(body.liftedById).toBe(admin.id);
    const stored = await db.userSuspension.findUniqueOrThrow({ where: { id } });
    expect(stored).toMatchObject({
      userId: target.id,
      liftedAt: expect.any(Date),
      liftedById: admin.id,
    });
    expect(stored.liftedAt?.toISOString()).toBe(
      new Date(body.liftedAt).toISOString(),
    );
    expect(
      await db.userSuspension.count({
        where: { userId: target.id, liftedAt: null },
      }),
    ).toBe(0);
    expect(
      await db.userSuspension.findUniqueOrThrow({ where: { id: known.id } }),
    ).toEqual(known);
    const audits = await db.auditLog.findMany();
    expect(audits).toHaveLength(2);
    expect(audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "admin_user_suspend",
          userId: admin.id,
          subjectUserId: target.id,
          targetId: target.id,
          channel: "rest",
        }),
        expect.objectContaining({
          action: "admin_user_unsuspend",
          userId: admin.id,
          subjectUserId: target.id,
          targetId: target.id,
          targetType: "user",
          channel: "rest",
          metadata: { suspensionId: id },
        }),
      ]),
    );
  });
});
