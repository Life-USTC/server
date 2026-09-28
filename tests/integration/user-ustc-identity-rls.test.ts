import { describe, expect } from "vitest";
import { syncUstcOidcIdentity } from "@/lib/auth/ustc-oidc-identity-sync";
import { prisma, withUserDbContext } from "@/lib/db/prisma";
import { rlsTest as it } from "../shared/rls-fixture";

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "UserUstcIdentity PostgreSQL row security",
  () => {
    it("fails closed without context and clears transaction-local context", async ({
      rlsRuntime,
      isolatedDatabase: { owner: fixturePrisma },
      rlsActors: { firstUserId: ownerUserId },
    }) => {
      await rlsRuntime.run(async () => {
        const upstreamUid = `identity-missing-context-${crypto.randomUUID()}`;
        const created = await withUserDbContext(ownerUserId, (tx) =>
          tx.userUstcIdentity.create({
            data: { userId: ownerUserId, upstreamUid },
            select: { id: true },
          }),
        );

        const storedBefore = await fixturePrisma.userUstcIdentity.findMany({
          orderBy: { id: "asc" },
        });
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
        await expect(
          fixturePrisma.userUstcIdentity.findMany({ orderBy: { id: "asc" } }),
        ).resolves.toEqual(storedBefore);
      });
    });
    it("isolates owners, exercises the sync service, and rejects forged ownership", async ({
      rlsRuntime,
      rlsActors: { firstUserId: ownerUserId, secondUserId: otherUserId },
      isolatedDatabase: { owner: fixturePrisma },
    }) => {
      await rlsRuntime.run(async () => {
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

        const storedBefore = await fixturePrisma.userUstcIdentity.findMany({
          orderBy: { id: "asc" },
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
          fixturePrisma.userUstcIdentity.findMany({ orderBy: { id: "asc" } }),
        ).resolves.toEqual(storedBefore);
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
    });
  },
);
