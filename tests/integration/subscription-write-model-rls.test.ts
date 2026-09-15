import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  batchUpdateUserSectionSubscriptions,
  removeUserSectionSubscriptions,
} from "@/features/subscriptions/server/subscription-write-model";
import { prisma, withUserDbContext } from "@/lib/db/prisma";
import { createFixturePrisma, disconnectTestPrisma } from "../shared/prisma";

const adminPrisma = createFixturePrisma();

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "subscription batch removal under PostgreSQL row security",
  () => {
    let sectionIds: [number, number];

    beforeAll(async () => {
      const [role] = await prisma.$queryRaw<
        Array<{ currentUser: string; superuser: boolean; bypassRls: boolean }>
      >`
        SELECT
          current_user AS "currentUser",
          rolsuper AS superuser,
          rolbypassrls AS "bypassRls"
        FROM pg_roles
        WHERE rolname = current_user
      `;
      expect(role).toEqual({
        currentUser: "life_ustc_runtime",
        superuser: false,
        bypassRls: false,
      });

      const [table] = await prisma.$queryRaw<
        Array<{ rlsEnabled: boolean; rlsForced: boolean }>
      >`
        SELECT
          relrowsecurity AS "rlsEnabled",
          relforcerowsecurity AS "rlsForced"
        FROM pg_class
        WHERE oid = 'public."UserSectionSubscription"'::regclass
      `;
      expect(table).toEqual({ rlsEnabled: true, rlsForced: true });

      const sections = await prisma.section.findMany({
        where: { retiredAt: null },
        orderBy: { id: "asc" },
        select: { id: true },
        take: 2,
      });
      if (sections.length !== 2) {
        throw new Error("Expected two seeded active sections");
      }
      sectionIds = [sections[0].id, sections[1].id];
    });

    afterAll(async () => {
      await Promise.all([
        prisma.$disconnect(),
        disconnectTestPrisma(adminPrisma),
      ]);
    });

    it("removes an owner subscription and reports truthful counts", async () => {
      const userId = `subscription-remove-rls-${crypto.randomUUID()}`;
      const otherUserId = `subscription-remove-rls-other-${crypto.randomUUID()}`;
      try {
        await adminPrisma.user.create({
          data: {
            id: userId,
            email: `${userId}@example.invalid`,
            name: "Subscription removal RLS test",
          },
        });
        await adminPrisma.user.create({
          data: {
            id: otherUserId,
            email: `${otherUserId}@example.invalid`,
            name: "Other subscription removal RLS test",
          },
        });

        await adminPrisma.userSectionSubscription.create({
          data: {
            userId,
            sectionId: sectionIds[0],
            kind: "teaching_assistant",
          },
        });
        await adminPrisma.userSectionSubscription.create({
          data: { userId, sectionId: sectionIds[1], kind: "regular" },
        });
        await adminPrisma.userSectionSubscription.create({
          data: {
            userId: otherUserId,
            sectionId: sectionIds[0],
            kind: "teaching_assistant",
          },
        });

        const result = await batchUpdateUserSectionSubscriptions({
          action: "remove",
          sectionIds: [sectionIds[0]],
          userId,
        });

        expect(result).toMatchObject({
          action: "remove",
          matchedSectionIds: [sectionIds[0]],
          unmatchedSectionIds: [],
          removedCount: 1,
          unchangedCount: 0,
          subscription: expect.objectContaining({
            sections: [
              expect.objectContaining({ id: sectionIds[1], kind: "regular" }),
            ],
          }),
        });

        await expect(
          withUserDbContext(otherUserId, (tx) =>
            tx.userSectionSubscription.findMany({
              select: { sectionId: true, kind: true },
            }),
          ),
        ).resolves.toEqual([
          { sectionId: sectionIds[0], kind: "teaching_assistant" },
        ]);

        const repeated = await batchUpdateUserSectionSubscriptions({
          action: "remove",
          sectionIds: [sectionIds[0]],
          userId,
        });
        expect(repeated).toMatchObject({
          removedCount: 0,
          unchangedCount: 1,
          subscription: expect.objectContaining({
            sections: [
              expect.objectContaining({ id: sectionIds[1], kind: "regular" }),
            ],
          }),
        });

        await expect(
          removeUserSectionSubscriptions(userId, [sectionIds[1]]),
        ).resolves.toBe(true);
        await expect(
          withUserDbContext(userId, (tx) =>
            tx.userSectionSubscription.findMany({
              select: { sectionId: true, kind: true },
            }),
          ),
        ).resolves.toEqual([]);
      } finally {
        await Promise.all([
          adminPrisma.user.delete({ where: { id: userId } }),
          adminPrisma.user.delete({ where: { id: otherUserId } }),
        ]);
      }
    });
  },
);
