import { describe, expect } from "vitest";
import {
  batchUpdateUserSectionSubscriptions,
  removeUserSectionSubscriptions,
} from "@/features/subscriptions/server/subscription-write-model";
import { prisma, withUserDbContext } from "@/lib/db/prisma";
import { rlsTest as it } from "../shared/rls-fixture";

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "subscription batch removal under PostgreSQL row security",
  () => {
    it("removes an owner subscription and reports truthful counts", async ({
      rlsRuntime,
      isolatedDatabase: { owner: adminPrisma },
      rlsActors: { firstUserId: userId, secondUserId: otherUserId },
      rlsSections: { sectionId, writeProbeSectionId },
    }) => {
      await rlsRuntime.run(async () => {
        const sectionIds = [sectionId, writeProbeSectionId];

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

        await expect(
          adminPrisma.userSectionSubscription.findMany({
            orderBy: [{ sectionId: "asc" }, { userId: "asc" }],
            select: { userId: true, sectionId: true, kind: true },
          }),
        ).resolves.toEqual([
          {
            userId: otherUserId,
            sectionId: sectionIds[0],
            kind: "teaching_assistant",
          },
          { userId, sectionId: sectionIds[1], kind: "regular" },
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
        await expect(
          adminPrisma.userSectionSubscription.findMany({
            select: { userId: true, sectionId: true, kind: true },
          }),
        ).resolves.toEqual([
          {
            userId: otherUserId,
            sectionId: sectionIds[0],
            kind: "teaching_assistant",
          },
        ]);
      });
    });
  },
);
