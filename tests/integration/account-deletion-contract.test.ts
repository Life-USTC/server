import { afterAll, expect, it } from "vitest";
import { deleteOwnAccount } from "@/features/settings/server/account-deletion-service";
import { authPrisma } from "@/lib/db/auth-prisma";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const users: string[] = [];
const requests: string[] = [];
afterAll(async () => {
  await db.auditLog.deleteMany({
    where: { OR: [{ requestId: { in: requests } }, { userId: { in: users } }] },
  });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await Promise.all([db.$disconnect(), authPrisma.$disconnect()]);
});
async function user() {
  const row = await db.user.create({
    data: { email: `delete-${crypto.randomUUID()}@example.test` },
  });
  users.push(row.id);
  return row.id;
}
async function session(userId: string, ageSeconds: number, expired = false) {
  return db.session.create({
    data: {
      userId,
      sessionToken: crypto.randomUUID(),
      createdAt: new Date(Date.now() - ageSeconds * 1000),
      expires: new Date(Date.now() + (expired ? -60_000 : 3600_000)),
    },
  });
}
async function remove(userId: string, sessionId: string) {
  const requestId = crypto.randomUUID();
  requests.push(requestId);
  return deleteOwnAccount(userId, { sessionId, requestId, channel: "web" });
}

it("user.account-deletion-session-authority", async () => {
  const subject = await user();
  const other = await user();
  for (const [owner, ageSeconds, expired, revoked] of [
    [subject, 901, false, false],
    [subject, -60, false, false],
    [subject, 0, true, false],
    [other, 0, false, false],
    [subject, 0, false, true],
  ] as const) {
    const row = await session(owner, ageSeconds, expired);
    if (revoked) await db.session.delete({ where: { id: row.id } });
    expect(await remove(subject, row.id)).toEqual({
      ok: false,
      reason: "unauthorized",
    });
    expect(await db.user.count({ where: { id: subject } })).toBe(1);
  }
  const fresh = await session(subject, 60);
  expect(await remove(subject, fresh.id)).toEqual({ ok: true });
  expect(await db.user.count({ where: { id: subject } })).toBe(0);
  expect(await db.user.count({ where: { id: other } })).toBe(1);
  // Updating the session and checking it in one SQL statement shares exactly
  // the database clock at Session timestamp(3) precision, avoiding rounding
  // or wall-clock races at the 15-minute boundary.
  for (const [ageMs, status] of [
    [-1, "unauthorized"],
    [900_000, "unauthorized"],
    [899_999, "deleted"],
    [0, "deleted"],
  ] as const) {
    const boundaryUser = await user();
    const row = await session(boundaryUser, 0);
    const requestId = crypto.randomUUID();
    requests.push(requestId);
    const result = await authPrisma.$queryRaw`
      WITH authority AS (
        UPDATE public."Session"
        SET "createdAt" = (date_trunc('milliseconds', statement_timestamp()) AT TIME ZONE 'UTC') - ${ageMs} * interval '1 millisecond'
        WHERE id = ${row.id}
        RETURNING id
      )
      SELECT public.delete_own_account(${boundaryUser}, ${crypto.randomUUID()},
        'web'::public."AuditChannel", NULL, NULL, authority.id, ${requestId}) AS status
      FROM authority`;
    expect(result, `session age ${ageMs}ms`).toEqual([{ status }]);
    expect(await db.user.count({ where: { id: boundaryUser } })).toBe(
      status === "deleted" ? 0 : 1,
    );
  }
});

it("user.account-deletion-last-admin", async () => {
  const rollback = new Error("Rollback isolated admin population");
  const existing = await db.user.findMany({
    where: { isAdmin: true },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  // The temporary admin population exists only inside this transaction. Other
  // connections never observe changes to seeded users; every write rolls back.
  await expect(
    db.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { isAdmin: true },
        data: { isAdmin: false },
      });
      const administrators = [];
      for (let i = 0; i < 2; i++) {
        const account = await tx.user.create({
          data: {
            email: `last-admin-${crypto.randomUUID()}@example.test`,
            isAdmin: true,
          },
        });
        const authority = await tx.session.create({
          data: {
            userId: account.id,
            sessionToken: crypto.randomUUID(),
            expires: new Date(Date.now() + 3600_000),
          },
        });
        administrators.push({ account, authority });
      }
      await tx.$executeRawUnsafe("SET LOCAL ROLE life_ustc_auth_runtime");
      expect(await tx.$queryRaw`SELECT current_user AS role`).toEqual([
        { role: "life_ustc_auth_runtime" },
      ]);
      for (const [i, { account, authority }] of administrators.entries()) {
        const result =
          await tx.$queryRaw`SELECT public.delete_own_account(${account.id}, ${crypto.randomUUID()}, 'web'::public."AuditChannel", NULL, NULL, ${authority.id}, NULL) AS status`;
        expect(result).toEqual([
          { status: i === 0 ? "deleted" : "cannot_remove_last_admin" },
        ]);
      }
      expect(await tx.user.count({ where: { isAdmin: true } })).toBe(1);
      throw rollback;
    }),
  ).rejects.toBe(rollback);
  expect(
    await db.user.findMany({
      where: { isAdmin: true },
      select: { id: true },
      orderBy: { id: "asc" },
    }),
  ).toEqual(existing);
});
