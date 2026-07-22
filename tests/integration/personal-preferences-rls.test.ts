import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, withUserDbContext } from "@/lib/db/prisma";

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "personal preference PostgreSQL row security",
  () => {
    const suffix = randomUUID();
    let firstUserId = "";
    let secondUserId = "";

    beforeAll(async () => {
      const users = await Promise.all([
        prisma.user.create({
          data: { email: `rls-first-${suffix}@example.test` },
          select: { id: true },
        }),
        prisma.user.create({
          data: { email: `rls-second-${suffix}@example.test` },
          select: { id: true },
        }),
      ]);
      firstUserId = users[0].id;
      secondUserId = users[1].id;
    });

    afterAll(async () => {
      for (const userId of [firstUserId, secondUserId]) {
        if (!userId) continue;
        await withUserDbContext(userId, async () => {
          await prisma.dashboardLinkClick.deleteMany({ where: { userId } });
          await prisma.dashboardLinkPin.deleteMany({ where: { userId } });
          await prisma.busUserPreference.deleteMany({ where: { userId } });
        });
      }
      await prisma.user.deleteMany({
        where: { id: { in: [firstUserId, secondUserId].filter(Boolean) } },
      });
    });

    it("defaults every protected preference table to no rows or writes", async () => {
      await expect(prisma.dashboardLinkClick.findMany()).resolves.toEqual([]);
      await expect(prisma.dashboardLinkPin.findMany()).resolves.toEqual([]);
      await expect(prisma.busUserPreference.findMany()).resolves.toEqual([]);
      await expect(
        prisma.dashboardLinkPin.create({
          data: { userId: firstUserId, slug: "missing-context" },
        }),
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
      await expect(
        withUserDbContext(secondUserId, () =>
          prisma.busUserPreference.update({
            where: { userId: firstUserId },
            data: { showDepartedTrips: true },
          }),
        ),
      ).rejects.toThrow();
    });
  },
);
