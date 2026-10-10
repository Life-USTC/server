import { expect, type Page } from "@playwright/test";
import type { AuditAction } from "@/generated/prisma/client";
import {
  type CommunityFlow,
  withCommunityFlow,
} from "../../../utils/community-flow";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { test as workerTest } from "../../../utils/owned-page";

async function setup(page: Page, worker: IsolatedWorker) {
  const db = worker.database.owner;
  const actor = await worker.createActor({ isAdmin: true });
  const marker = `admin-audit-${crypto.randomUUID()}`;
  const users = await db.$transaction(async (tx) => {
    const admin = await tx.user.update({
      where: { id: actor.id },
      data: { name: "Private administrator name" },
    });
    const target = await tx.user.create({
      data: {
        name: "Private managed user name",
        username: `at${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        email: `${marker}-target@example.test`,
      },
    });
    return { admin, target };
  });
  await page.context().addCookies([actor.cookie]);
  const reason = `${marker} private reason`;
  const note = `${marker} private note`;
  const content = `${marker} private comment content`;
  let constraint: string | undefined;
  return {
    ...users,
    db,
    reason,
    note,
    content,
    async rejectAudit(action: AuditAction) {
      constraint = `admin_audit_${crypto.randomUUID().replaceAll("-", "")}`;
      await db.$executeRawUnsafe(
        `ALTER TABLE "AuditLog" ADD CONSTRAINT "${constraint}" CHECK ("userId" IS DISTINCT FROM '${users.admin.id.replaceAll("'", "''")}' OR "action" <> '${action}') NOT VALID`,
      );
    },
    async restoreAudit() {
      if (constraint) {
        await db.$executeRawUnsafe(
          `ALTER TABLE "AuditLog" DROP CONSTRAINT "${constraint}"`,
        );
        constraint = undefined;
      }
    },
    async events(action: AuditAction) {
      return db.auditLog.findMany({
        where: { userId: users.admin.id, action },
      });
    },
    assertSafe(events: unknown) {
      for (const secret of [
        reason,
        note,
        content,
        actor.cookie.value,
        users.admin.name,
        users.admin.email,
        users.target.name,
        users.target.email,
      ])
        expect(JSON.stringify(events)).not.toContain(secret);
    },
  };
}

export const test = workerTest.extend<{
  audit: Awaited<ReturnType<typeof setup>>;
  auditFlow: CommunityFlow;
}>({
  audit: async ({ page, isolatedWorker, run }, use) => {
    // The enclosing Worker owns all records and DDL, including partial setup.
    // Stop it before dropping the database; a failed body need not restore it.
    await use(await run(() => setup(page, isolatedWorker)));
  },
  auditFlow: async (
    { page, browser, request: observer, isolatedWorker, audit, run },
    use,
  ) => {
    await run(() =>
      withCommunityFlow(
        {
          page,
          browser,
          observer,
          isolatedWorker,
          account: audit.admin,
        },
        use,
      ),
    );
  },
});
