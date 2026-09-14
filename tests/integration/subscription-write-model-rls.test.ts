import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { batchUpdateUserSectionSubscriptions } from "@/features/subscriptions/server/subscription-write-model";
import { prisma } from "@/lib/db/prisma";
import { createTestPrisma } from "../shared/prisma";

const adminPrisma = createTestPrisma(
  process.env.FUNCTION_OWNER_DATABASE_URL ?? process.env.DATABASE_URL,
);

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "subscription batch removal under PostgreSQL row security",
  () => {
    let sectionIds: [number, number];

    beforeAll(async () => {
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
      await Promise.all([prisma.$disconnect(), adminPrisma.$disconnect()]);
    });

    it("removes an owner subscription and reports truthful counts", async () => {
      const userId = `subscription-remove-rls-${crypto.randomUUID()}`;
      await adminPrisma.user.create({
        data: {
          id: userId,
          email: `${userId}@example.invalid`,
          name: "Subscription removal RLS test",
        },
      });

      try {
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
      } finally {
        await adminPrisma.user.delete({ where: { id: userId } });
      }
    });
  },
);
