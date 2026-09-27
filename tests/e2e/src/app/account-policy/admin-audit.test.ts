import { expect, type Page, test } from "@playwright/test";
import type { AuditAction } from "@/generated/prisma/client";
import { DEV_SEED } from "../../../utils/dev-seed";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

async function setup(page: Page) {
  const marker = `admin-audit-${crypto.randomUUID()}`;
  const users = await withE2ePrisma(async (db) => {
    const admin = await db.user.create({
      data: {
        name: "Private administrator name",
        username: `aa${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        email: `${marker}-admin@example.test`,
        isAdmin: true,
      },
    });
    const target = await db.user.create({
      data: {
        name: "Private managed user name",
        username: `at${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        email: `${marker}-target@example.test`,
      },
    });
    return { admin, target };
  });
  const cookie = await createSignedSessionCookie(users.admin.id);
  await page.context().addCookies([cookie]);
  const reason = `${marker} private reason`;
  const note = `${marker} private note`;
  const content = `${marker} private comment content`;
  let constraint: string | undefined;
  return {
    ...users,
    reason,
    note,
    content,
    async rejectAudit(action: AuditAction) {
      constraint = `admin_audit_${crypto.randomUUID().replaceAll("-", "")}`;
      await withE2ePrisma((db) =>
        db.$executeRawUnsafe(
          `ALTER TABLE "AuditLog" ADD CONSTRAINT "${constraint}" CHECK ("userId" IS DISTINCT FROM '${users.admin.id.replaceAll("'", "''")}' OR "action" <> '${action}') NOT VALID`,
        ),
      );
    },
    async restoreAudit() {
      if (constraint) {
        await withE2ePrisma((db) =>
          db.$executeRawUnsafe(
            `ALTER TABLE "AuditLog" DROP CONSTRAINT "${constraint}"`,
          ),
        );
        constraint = undefined;
      }
    },
    async events(action: AuditAction) {
      return withE2ePrisma((db) =>
        db.auditLog.findMany({ where: { userId: users.admin.id, action } }),
      );
    },
    assertSafe(events: unknown) {
      for (const secret of [
        reason,
        note,
        content,
        cookie.value,
        users.admin.name,
        users.admin.email,
        users.target.name,
        users.target.email,
      ])
        expect(JSON.stringify(events)).not.toContain(secret);
    },
    async cleanup() {
      if (constraint)
        await withE2ePrisma((db) =>
          db.$executeRawUnsafe(
            `ALTER TABLE "AuditLog" DROP CONSTRAINT "${constraint}"`,
          ),
        );
      await withE2ePrisma(async (db) => {
        await db.auditLog.deleteMany({ where: { userId: users.admin.id } });
        await db.comment.deleteMany({ where: { userId: users.target.id } });
        await db.user.deleteMany({
          where: { id: { in: [users.admin.id, users.target.id] } },
        });
      });
    },
  };
}

test("audit.action-admin-user-suspend", async ({ page }) => {
  const f = await setup(page);
  try {
    const prior = await withE2ePrisma((db) =>
      db.userSuspension.create({
        data: {
          userId: f.target.id,
          createdById: f.admin.id,
          reason: "Previous private reason",
        },
      }),
    );
    const submit = () =>
      page.request.post("/api/admin/suspensions", {
        data: {
          userId: f.target.id,
          reason: f.reason,
          note: f.note,
          expiresAt: "2030-01-01T00:00:00.000Z",
        },
      });
    await f.rejectAudit("admin_user_suspend");
    expect((await submit()).status()).toBe(500);
    expect(
      await withE2ePrisma((db) =>
        db.userSuspension.findMany({ where: { userId: f.target.id } }),
      ),
    ).toEqual([prior]);
    expect(await f.events("admin_user_suspend")).toHaveLength(0);
    await f.restoreAudit();
    const response = await submit();
    expect(response.status(), await response.text()).toBe(201);
    const { suspension } = await response.json();
    const rows = await withE2ePrisma((db) =>
      db.userSuspension.findMany({ where: { userId: f.target.id } }),
    );
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === prior.id)).toMatchObject({
      liftedAt: expect.any(Date),
      liftedById: f.admin.id,
    });
    expect(rows.find((row) => row.id === suspension.id)).toMatchObject({
      userId: f.target.id,
      createdById: f.admin.id,
      reason: f.reason,
      note: f.note,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      liftedAt: null,
    });
    const events = await f.events("admin_user_suspend");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      userId: f.admin.id,
      subjectUserId: f.target.id,
      targetId: f.target.id,
      targetType: "user",
      channel: "rest",
      outcome: "success",
      oauthClientId: null,
      oauthGrantId: null,
      metadata: { reasonProvided: true },
    });
    expect(events[0].metadata).toEqual({ reasonProvided: true });
    f.assertSafe(events);
  } finally {
    await f.cleanup();
  }
});

test("audit.action-admin-user-unsuspend", async ({ page }) => {
  const f = await setup(page);
  try {
    const prior = await withE2ePrisma((db) =>
      db.userSuspension.create({
        data: {
          userId: f.target.id,
          createdById: f.admin.id,
          reason: f.reason,
          note: f.note,
        },
      }),
    );
    const submit = () =>
      page.request.patch(`/api/admin/suspensions/${prior.id}`);
    await f.rejectAudit("admin_user_unsuspend");
    expect((await submit()).status()).toBe(500);
    expect(
      await withE2ePrisma((db) =>
        db.userSuspension.findUnique({ where: { id: prior.id } }),
      ),
    ).toEqual(prior);
    expect(await f.events("admin_user_unsuspend")).toHaveLength(0);
    await f.restoreAudit();
    expect((await submit()).status()).toBe(200);
    expect(
      await withE2ePrisma((db) =>
        db.userSuspension.findUnique({ where: { id: prior.id } }),
      ),
    ).toMatchObject({
      liftedAt: expect.any(Date),
      liftedById: f.admin.id,
    });
    const events = await f.events("admin_user_unsuspend");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      userId: f.admin.id,
      subjectUserId: f.target.id,
      targetId: f.target.id,
      targetType: "user",
      channel: "rest",
      outcome: "success",
      metadata: { suspensionId: prior.id },
    });
    expect(events[0].metadata).toEqual({ suspensionId: prior.id });
    f.assertSafe(events);
  } finally {
    await f.cleanup();
  }
});

test("audit.action-admin-comment-moderate", async ({ page }) => {
  const f = await setup(page);
  try {
    const section = await withE2ePrisma((db) =>
      db.section.findUniqueOrThrow({ where: { jwId: DEV_SEED.section.jwId } }),
    );
    const prior = await withE2ePrisma((db) =>
      db.comment.create({
        data: {
          userId: f.target.id,
          sectionId: section.id,
          body: f.content,
          visibility: "public",
          status: "active",
        },
      }),
    );
    const submit = () =>
      page.request.patch(`/api/admin/comments/${prior.id}`, {
        data: {
          status: "softbanned",
          moderationNote: f.note,
        },
      });
    await f.rejectAudit("admin_comment_moderate");
    expect((await submit()).status()).toBe(500);
    expect(
      await withE2ePrisma((db) =>
        db.comment.findUnique({ where: { id: prior.id } }),
      ),
    ).toEqual(prior);
    expect(await f.events("admin_comment_moderate")).toHaveLength(0);
    await f.restoreAudit();
    expect((await submit()).status()).toBe(200);
    expect(
      await withE2ePrisma((db) =>
        db.comment.findUnique({ where: { id: prior.id } }),
      ),
    ).toMatchObject({
      body: f.content,
      status: "softbanned",
      moderationNote: f.note,
      moderatedById: f.admin.id,
      moderatedAt: expect.any(Date),
      deletedAt: null,
    });
    const events = await f.events("admin_comment_moderate");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      userId: f.admin.id,
      subjectUserId: f.target.id,
      targetId: prior.id,
      targetType: "comment",
      channel: "rest",
      outcome: "success",
      metadata: { status: "softbanned", moderationNoteProvided: true },
    });
    expect(events[0].metadata).toEqual({
      status: "softbanned",
      moderationNoteProvided: true,
    });
    f.assertSafe(events);
  } finally {
    await f.cleanup();
  }
});
