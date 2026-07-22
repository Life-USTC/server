import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteOwnAccount } from "@/features/settings/server/account-deletion-service";
import { prisma, withUserDbContext } from "@/lib/db/prisma";

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "personal preference PostgreSQL row security",
  () => {
    let firstUserId = "";
    let secondUserId = "";

    async function clearPreferences(userId: string) {
      await withUserDbContext(userId, async () => {
        await prisma.dashboardLinkClick.deleteMany({ where: { userId } });
        await prisma.dashboardLinkPin.deleteMany({ where: { userId } });
        await prisma.busUserPreference.deleteMany({ where: { userId } });
      });
    }

    beforeAll(async () => {
      const users = await prisma.user.findMany({
        select: { id: true },
        orderBy: { id: "asc" },
        take: 2,
      });
      if (users.length < 2) throw new Error("Expected two seeded users");
      firstUserId = users[0].id;
      secondUserId = users[1].id;
      await Promise.all([
        clearPreferences(firstUserId),
        clearPreferences(secondUserId),
      ]);
    });

    afterAll(async () => {
      for (const userId of [firstUserId, secondUserId]) {
        if (!userId) continue;
        await clearPreferences(userId);
      }
      await prisma.$disconnect();
    });

    it("defaults every protected preference table to no rows or writes", async () => {
      await expect(prisma.dashboardLinkClick.findMany()).resolves.toEqual([]);
      await expect(prisma.dashboardLinkPin.findMany()).resolves.toEqual([]);
      await expect(prisma.busUserPreference.findMany()).resolves.toEqual([]);
      await expect(
        prisma.dashboardLinkClick.create({
          data: { userId: firstUserId, slug: "missing-context" },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.dashboardLinkPin.create({
          data: { userId: firstUserId, slug: "missing-context" },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.busUserPreference.create({ data: { userId: firstUserId } }),
      ).rejects.toThrow();
    });

    it("isolates concurrent owners across clicks, pins, and bus preferences", async () => {
      await Promise.all(
        [firstUserId, secondUserId].map((userId, index) =>
          withUserDbContext(userId, async () => {
            await prisma.dashboardLinkClick.create({
              data: { userId, slug: `rls-click-${index}` },
            });
            await prisma.dashboardLinkPin.create({
              data: { userId, slug: `rls-pin-${index}` },
            });
            await prisma.busUserPreference.create({ data: { userId } });
          }),
        ),
      );

      const [firstRows, secondRows] = await Promise.all(
        [firstUserId, secondUserId].map((userId) =>
          withUserDbContext(userId, async () => ({
            clicks: await prisma.dashboardLinkClick.findMany({
              select: { userId: true },
            }),
            pins: await prisma.dashboardLinkPin.findMany({
              select: { userId: true },
            }),
            preferences: await prisma.busUserPreference.findMany({
              select: { userId: true },
            }),
          })),
        ),
      );
      expect(firstRows).toEqual({
        clicks: [{ userId: firstUserId }],
        pins: [{ userId: firstUserId }],
        preferences: [{ userId: firstUserId }],
      });
      expect(secondRows).toEqual({
        clicks: [{ userId: secondUserId }],
        pins: [{ userId: secondUserId }],
        preferences: [{ userId: secondUserId }],
      });
    });

    it("rejects forged ownership on every protected preference table", async () => {
      await expect(
        withUserDbContext(secondUserId, () =>
          prisma.dashboardLinkClick.create({
            data: { userId: firstUserId, slug: "forged-click" },
          }),
        ),
      ).rejects.toThrow();
      await expect(
        withUserDbContext(secondUserId, () =>
          prisma.dashboardLinkPin.create({
            data: { userId: firstUserId, slug: "forged-pin" },
          }),
        ),
      ).rejects.toThrow();
      await withUserDbContext(firstUserId, () =>
        prisma.busUserPreference.deleteMany({ where: { userId: firstUserId } }),
      );
      await expect(
        withUserDbContext(secondUserId, () =>
          prisma.busUserPreference.create({
            data: { userId: firstUserId },
          }),
        ),
      ).rejects.toThrow();
    });

    it("keeps self-service account deletion cascades inside owner context", async () => {
      await withUserDbContext(secondUserId, () =>
        prisma.todo.create({
          data: { title: "[rls-test] account cascade", userId: secondUserId },
        }),
      );

      await expect(deleteOwnAccount(secondUserId)).resolves.toEqual({
        ok: true,
      });
      await expect(
        prisma.user.findUnique({ where: { id: secondUserId } }),
      ).resolves.toBeNull();
      secondUserId = "";
    });
  },
);
