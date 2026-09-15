import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { syncUstcOidcIdentity } from "@/lib/auth/ustc-oidc-identity-sync";
import { prisma, withUserDbContext } from "@/lib/db/prisma";
import { createFixturePrisma, disconnectTestPrisma } from "../shared/prisma";

const rlsTestUserIds = ["rls-test-user-a", "rls-test-user-b"] as const;
const fixturePrisma = createFixturePrisma();

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "UserUstcIdentity PostgreSQL row security",
  () => {
    let ownerUserId = "";
    let otherUserId = "";

    beforeAll(async () => {
      const users = await prisma.user.findMany({
        where: { id: { in: [...rlsTestUserIds] } },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      if (users.length !== 2) throw new Error("Expected two RLS test users");
      ownerUserId = users[0].id;
      otherUserId = users[1].id;
    });

    beforeEach(async () => {
      await fixturePrisma.userUstcIdentity.deleteMany({
        where: { userId: { in: [ownerUserId, otherUserId] } },
      });
    });

    afterAll(async () => {
      await fixturePrisma.userUstcIdentity.deleteMany({
        where: { userId: { in: [ownerUserId, otherUserId] } },
      });
      await Promise.all([
        prisma.$disconnect(),
        disconnectTestPrisma(fixturePrisma),
      ]);
    });

    it("fails closed without context and clears transaction-local context", async () => {
      const upstreamUid = `identity-missing-context-${crypto.randomUUID()}`;
      const created = await withUserDbContext(ownerUserId, (tx) =>
        tx.userUstcIdentity.create({
          data: { userId: ownerUserId, upstreamUid },
          select: { id: true },
        }),
      );

      await expect(
        prisma.userUstcIdentity.findMany({ where: { id: created.id } }),
      ).resolves.toEqual([]);
      await expect(
        prisma.userUstcIdentity.create({
          data: {
            userId: ownerUserId,
            upstreamUid: `identity-write-without-context-${crypto.randomUUID()}`,
          },
        }),
      ).rejects.toThrow();

      await expect(
        withUserDbContext(ownerUserId, async (tx) => {
          const rows = await tx.userUstcIdentity.findMany({
            where: { id: created.id },
            select: { userId: true, upstreamUid: true },
          });
          const [context] = await tx.$queryRaw<
            Array<{ userId: string | null }>
          >`SELECT current_setting('app.user_id', true) AS "userId"`;
          return { context, rows };
        }),
      ).resolves.toEqual({
        context: { userId: ownerUserId },
        rows: [{ userId: ownerUserId, upstreamUid }],
      });

      const [outsideContext] = await prisma.$queryRaw<
        Array<{ userId: string | null }>
      >`SELECT NULLIF(current_setting('app.user_id', true), '') AS "userId"`;
      expect(outsideContext).toEqual({ userId: null });
      await expect(
        prisma.userUstcIdentity.findMany({ where: { id: created.id } }),
      ).resolves.toEqual([]);
    });

    it("isolates owners, exercises the sync service, and rejects forged ownership", async () => {
      const ownerUpstreamUid = `identity-owner-${crypto.randomUUID()}`;
      const otherUpstreamUid = `identity-other-${crypto.randomUUID()}`;

      // The service owns its RLS context; the test deliberately does not wrap
      // this call in an outer context.
      await syncUstcOidcIdentity({
        userId: ownerUserId,
        upstreamUid: ownerUpstreamUid,
        gid: " owner-gid ",
        sno: " owner-sno ",
      });
      await syncUstcOidcIdentity({
        userId: otherUserId,
        upstreamUid: otherUpstreamUid,
        gid: "other-gid",
        sno: "other-sno",
      });

      const ownerRows = await withUserDbContext(ownerUserId, (tx) =>
        tx.userUstcIdentity.findMany({
          select: { userId: true, upstreamUid: true, gid: true, sno: true },
          orderBy: { upstreamUid: "asc" },
        }),
      );
      const otherRows = await withUserDbContext(otherUserId, (tx) =>
        tx.userUstcIdentity.findMany({
          select: { userId: true, upstreamUid: true, gid: true, sno: true },
          orderBy: { upstreamUid: "asc" },
        }),
      );
      expect(ownerRows).toEqual([
        {
          userId: ownerUserId,
          upstreamUid: ownerUpstreamUid,
          gid: "owner-gid",
          sno: "owner-sno",
        },
      ]);
      expect(otherRows).toEqual([
        {
          userId: otherUserId,
          upstreamUid: otherUpstreamUid,
          gid: "other-gid",
          sno: "other-sno",
        },
      ]);

      const ownerIdentity =
        await fixturePrisma.userUstcIdentity.findFirstOrThrow({
          where: { userId: ownerUserId, upstreamUid: ownerUpstreamUid },
          select: { id: true },
        });

      await expect(
        withUserDbContext(otherUserId, (tx) =>
          tx.userUstcIdentity.findMany({ where: { id: ownerIdentity.id } }),
        ),
      ).resolves.toEqual([]);
      await expect(
        withUserDbContext(otherUserId, (tx) =>
          tx.userUstcIdentity.updateMany({
            where: { id: ownerIdentity.id },
            data: { gid: "forged-update" },
          }),
        ),
      ).resolves.toEqual({ count: 0 });
      await expect(
        withUserDbContext(otherUserId, (tx) =>
          tx.userUstcIdentity.deleteMany({ where: { id: ownerIdentity.id } }),
        ),
      ).resolves.toEqual({ count: 0 });
      await expect(
        withUserDbContext(otherUserId, (tx) =>
          tx.userUstcIdentity.create({
            data: {
              userId: ownerUserId,
              upstreamUid: `identity-forged-create-${crypto.randomUUID()}`,
            },
          }),
        ),
      ).rejects.toThrow();
      await expect(
        withUserDbContext(ownerUserId, (tx) =>
          tx.userUstcIdentity.update({
            where: { id: ownerIdentity.id },
            data: { userId: otherUserId },
          }),
        ),
      ).rejects.toThrow();

      await expect(
        withUserDbContext(ownerUserId, (tx) =>
          tx.userUstcIdentity.update({
            where: { id: ownerIdentity.id },
            data: { gid: "owner-gid-updated" },
            select: { userId: true, gid: true },
          }),
        ),
      ).resolves.toEqual({ userId: ownerUserId, gid: "owner-gid-updated" });
      await expect(
        fixturePrisma.userUstcIdentity.findUnique({
          where: { id: ownerIdentity.id },
          select: { userId: true, gid: true },
        }),
      ).resolves.toEqual({ userId: ownerUserId, gid: "owner-gid-updated" });
    });
  },
);
