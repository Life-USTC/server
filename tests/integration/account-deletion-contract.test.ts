import { deleteOwnAccount } from "@/features/settings/server/account-deletion-service";
import { authPrisma } from "@/lib/db/auth-prisma";
import type { Prisma } from "../../src/generated/prisma-node/client";
import { nodeProtocolTest as it } from "../shared/node-protocol-fixture";

function user(db: Prisma.TransactionClient) {
  return db.user.create({
    data: { email: `delete-${crypto.randomUUID()}@example.test` },
  });
}

function session(
  db: Prisma.TransactionClient,
  userId: string,
  ageSeconds: number,
  expired = false,
) {
  return db.session.create({
    data: {
      userId,
      sessionToken: crypto.randomUUID(),
      createdAt: new Date(Date.now() - ageSeconds * 1000),
      expires: new Date(Date.now() + (expired ? -60_000 : 3600_000)),
    },
  });
}

it.for([
  {
    name: "stale",
    ageSeconds: 901,
    expired: false,
    revoked: false,
    otherOwner: false,
  },
  {
    name: "future-dated",
    ageSeconds: -60,
    expired: false,
    revoked: false,
    otherOwner: false,
  },
  {
    name: "expired",
    ageSeconds: 0,
    expired: true,
    revoked: false,
    otherOwner: false,
  },
  {
    name: "other-user",
    ageSeconds: 0,
    expired: false,
    revoked: false,
    otherOwner: true,
  },
  {
    name: "revoked",
    ageSeconds: 0,
    expired: false,
    revoked: true,
    otherOwner: false,
  },
])(
  "user.account-deletion-session-authority rejects $name session",
  { tags: ["@Account/Service"] },
  async (
    { ageSeconds, expired, revoked, otherOwner },
    { isolatedDatabase: { owner: db }, protocolRuntime, expect },
  ) => {
    await protocolRuntime.run(async () => {
      const { subject, row } = await db.$transaction(async (tx) => {
        const subject = (await user(tx)).id;
        const owner = otherOwner ? (await user(tx)).id : subject;
        const row = await session(tx, owner, ageSeconds, expired);
        return { subject, row };
      });
      // Revocation is an independent server-side change to a persisted session.
      if (revoked) await db.session.delete({ where: { id: row.id } });
      expect(
        await protocolRuntime.request(() =>
          deleteOwnAccount(subject, {
            sessionId: row.id,
            requestId: crypto.randomUUID(),
            channel: "web",
          }),
        ),
      ).toEqual({ ok: false, reason: "unauthorized" });
      expect(await db.user.count({ where: { id: subject } })).toBe(1);
    });
  },
);

it("user.account-deletion-session-authority deletes only the fresh session owner", {
  tags: ["@Account/Service"],
}, async ({ isolatedDatabase: { owner: db }, protocolRuntime, expect }) => {
  await protocolRuntime.run(async () => {
    const { subject, other, fresh } = await db.$transaction(async (tx) => {
      const subject = (await user(tx)).id;
      const other = (await user(tx)).id;
      const fresh = await session(tx, subject, 60);
      return { subject, other, fresh };
    });
    expect(
      await protocolRuntime.request(() =>
        deleteOwnAccount(subject, {
          sessionId: fresh.id,
          requestId: crypto.randomUUID(),
          channel: "web",
        }),
      ),
    ).toEqual({ ok: true });
    expect(await db.user.count({ where: { id: subject } })).toBe(0);
    expect(await db.user.count({ where: { id: other } })).toBe(1);
  });
});

it.for([
  { ageMs: -1, status: "unauthorized" },
  { ageMs: 900_000, status: "unauthorized" },
  { ageMs: 899_999, status: "deleted" },
  { ageMs: 0, status: "deleted" },
])(
  "user.account-deletion-session-authority SQL clock age $ageMs ms",
  { tags: ["@Account/Service"] },
  async (
    { ageMs, status },
    { isolatedDatabase: { owner: db }, protocolRuntime, expect },
  ) => {
    await protocolRuntime.run(async () => {
      const { boundaryUser, row } = await db.$transaction(async (tx) => {
        const boundaryUser = (await user(tx)).id;
        const row = await session(tx, boundaryUser, 0);
        return { boundaryUser, row };
      });
      const requestId = crypto.randomUUID();
      // Updating the session and checking it in one SQL statement shares exactly
      // the database clock at Session timestamp(3) precision, avoiding rounding
      // or wall-clock races at the 15-minute boundary.
      const result = await protocolRuntime.request(
        () => authPrisma.$queryRaw`
        WITH authority AS (
          UPDATE public."Session"
          SET "createdAt" = (date_trunc('milliseconds', statement_timestamp()) AT TIME ZONE 'UTC') - ${ageMs} * interval '1 millisecond'
          WHERE id = ${row.id}
          RETURNING id
        )
        SELECT public.delete_own_account(${boundaryUser}, ${crypto.randomUUID()},
          'web'::public."AuditChannel", NULL, NULL, authority.id, ${requestId}) AS status
        FROM authority`,
      );
      expect(result, `session age ${ageMs}ms`).toEqual([{ status }]);
      expect(await db.user.count({ where: { id: boundaryUser } })).toBe(
        status === "deleted" ? 0 : 1,
      );
    });
  },
);

it("user.account-deletion-last-admin", { tags: ["@Account/Service"] }, async ({
  isolatedDatabase: { owner: db },
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const rollback = new Error("Rollback isolated admin population");
    const existing = await db.user.findMany({
      where: { isAdmin: true },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    expect(existing).toEqual([]);
    // This private database starts empty. The temporary administrators exist
    // only inside the transaction, whose actual deletions run as the auth role.
    await expect(
      protocolRuntime.request(() =>
        db.$transaction(async (tx) => {
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
          // The owner uses a separate connection, so uncommitted state is invisible.
          expect(
            await db.user.findMany({
              where: { isAdmin: true },
              select: { id: true },
              orderBy: { id: "asc" },
            }),
          ).toEqual(existing);
          throw rollback;
        }),
      ),
    ).rejects.toBe(rollback);
    expect(
      await db.user.findMany({
        where: { isAdmin: true },
        select: { id: true },
        orderBy: { id: "asc" },
      }),
    ).toEqual(existing);
  });
});
