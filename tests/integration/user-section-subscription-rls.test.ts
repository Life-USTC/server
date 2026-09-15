import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, withUserDbContext } from "@/lib/db/prisma";
import { createFixturePrisma, disconnectTestPrisma } from "../shared/prisma";

const rlsTestUserIds = ["rls-test-user-a", "rls-test-user-b"] as const;
const adminPrisma = createFixturePrisma();

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "UserSectionSubscription PostgreSQL row security",
  () => {
    let firstUserId = "";
    let secondUserId = "";
    let sectionId = 0;
    let writeProbeSectionId = 0;

    beforeAll(async () => {
      const users = await prisma.user.findMany({
        where: { id: { in: [...rlsTestUserIds] } },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      if (users.length !== 2) throw new Error("Expected two RLS test users");
      firstUserId = users[0].id;
      secondUserId = users[1].id;

      const sections = await prisma.section.findMany({
        select: { id: true },
        orderBy: { id: "asc" },
        take: 2,
      });
      if (sections.length < 2) throw new Error("Expected two seeded sections");
      sectionId = sections[0].id;
      writeProbeSectionId = sections[1].id;
    });

    beforeEach(async () => {
      await adminPrisma.userSectionSubscription.deleteMany({
        where: { userId: { in: [firstUserId, secondUserId] } },
      });
    });

    afterAll(async () => {
      await adminPrisma.userSectionSubscription.deleteMany({
        where: { userId: { in: [firstUserId, secondUserId] } },
      });
      await Promise.all([
        prisma.$disconnect(),
        disconnectTestPrisma(adminPrisma),
      ]);
    });

    it("defaults to no rows or writes without an owner context", async () => {
      const created = await withUserDbContext(firstUserId, (tx) =>
        tx.userSectionSubscription.create({
          data: { sectionId, userId: firstUserId },
          select: { sectionId: true, userId: true },
        }),
      );

      try {
        await expect(
          withUserDbContext(firstUserId, (tx) =>
            tx.userSectionSubscription.findUnique({
              where: { userId_sectionId: { userId: firstUserId, sectionId } },
              select: { sectionId: true, userId: true },
            }),
          ),
        ).resolves.toEqual(created);
        await expect(
          prisma.userSectionSubscription.findMany({
            where: { userId: firstUserId, sectionId },
          }),
        ).resolves.toEqual([]);
        await expect(
          prisma.userSectionSubscription.updateMany({
            where: { userId: firstUserId, sectionId },
            data: { kind: "teaching_assistant" },
          }),
        ).resolves.toEqual({ count: 0 });
        await expect(
          prisma.userSectionSubscription.deleteMany({
            where: { userId: firstUserId, sectionId },
          }),
        ).resolves.toEqual({ count: 0 });
        await expect(
          prisma.userSectionSubscription.create({
            data: { sectionId: writeProbeSectionId, userId: firstUserId },
          }),
        ).rejects.toThrow();
      } finally {
        await adminPrisma.userSectionSubscription.deleteMany({
          where: {
            userId: firstUserId,
            sectionId: { in: [sectionId, writeProbeSectionId] },
          },
        });
      }
    });

    it("isolates owners and rejects forged ownership", async () => {
      await withUserDbContext(firstUserId, (tx) =>
        tx.userSectionSubscription.create({
          data: { sectionId, userId: firstUserId },
        }),
      );

      await expect(
        withUserDbContext(firstUserId, (tx) =>
          tx.userSectionSubscription.findMany({
            select: { sectionId: true, userId: true },
          }),
        ),
      ).resolves.toEqual([{ sectionId, userId: firstUserId }]);

      await expect(
        withUserDbContext(secondUserId, (tx) =>
          tx.userSectionSubscription.findMany({
            where: { sectionId },
          }),
        ),
      ).resolves.toEqual([]);

      await expect(
        withUserDbContext(secondUserId, (tx) =>
          tx.userSectionSubscription.create({
            data: { sectionId, userId: firstUserId },
          }),
        ),
      ).rejects.toThrow();
    });
    it("allows only the owner to update a subscription kind", async () => {
      await withUserDbContext(firstUserId, (tx) =>
        tx.userSectionSubscription.create({
          data: { userId: firstUserId, sectionId },
        }),
      );
      const other = await withUserDbContext(secondUserId, (tx) =>
        tx.userSectionSubscription.updateMany({
          where: { userId: firstUserId, sectionId },
          data: { kind: "teaching_assistant" },
        }),
      );
      expect(other.count).toBe(0);
      const owned = await withUserDbContext(firstUserId, (tx) =>
        tx.userSectionSubscription.update({
          where: { userId_sectionId: { userId: firstUserId, sectionId } },
          data: { kind: "auditor" },
          select: { kind: true },
        }),
      );
      expect(owned.kind).toBe("auditor");
    });
  },
);
