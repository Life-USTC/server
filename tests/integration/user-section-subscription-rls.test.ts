import { describe, expect } from "vitest";
import { prisma, withUserDbContext } from "@/lib/db/prisma";
import { rlsTest as it } from "../shared/rls-fixture";

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "UserSectionSubscription PostgreSQL row security",
  () => {
    it("defaults to no rows or writes without an owner context", async ({
      rlsRuntime,
      rlsActors: { firstUserId },
      rlsSections: { sectionId, writeProbeSectionId },
    }) => {
      await rlsRuntime.run(async () => {
        const created = await withUserDbContext(firstUserId, (tx) =>
          tx.userSectionSubscription.create({
            data: { sectionId, userId: firstUserId },
            select: { sectionId: true, userId: true },
          }),
        );
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
      });
    });
    it("isolates owners and rejects forged ownership", async ({
      rlsRuntime,
      rlsActors: { firstUserId, secondUserId },
      rlsSections: { sectionId },
    }) => {
      await rlsRuntime.run(async () => {
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
    });
    it("allows only the owner to update a subscription kind", async ({
      rlsRuntime,
      rlsActors: { firstUserId, secondUserId },
      rlsSections: { sectionId },
    }) => {
      await rlsRuntime.run(async () => {
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
    });
  },
);
