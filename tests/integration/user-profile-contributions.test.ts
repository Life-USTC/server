import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildUserProfileContributions,
  loadUserProfileContributionDays,
} from "@/features/profile/server/user-profile-contributions";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createFixturePrisma, disconnectTestPrisma } from "../shared/prisma";

const fixturePrisma = createFixturePrisma();
const referenceNow = new Date("2026-03-02T01:30:00+08:00");
const startAt = new Date("2025-03-02T16:00:00.000Z");

describe("public profile contribution aggregation", {
  concurrent: false,
}, () => {
  let userId = "";
  let otherUserId = "";

  beforeAll(async () => {
    const section = await fixturePrisma.section.findFirst({
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (!section) {
      throw new Error(
        "Expected the canonical integration seed to include a section",
      );
    }

    const marker = crypto.randomUUID();
    const [user, otherUser] = await Promise.all([
      fixturePrisma.user.create({
        data: {
          email: `profile-contributions-${marker}@example.test`,
          name: "Profile contribution integration",
          username: `profile-contributions-${marker}`,
        },
        select: { id: true },
      }),
      fixturePrisma.user.create({
        data: {
          email: `profile-contributions-other-${marker}@example.test`,
          name: "Other profile contribution integration",
          username: `profile-contributions-other-${marker}`,
        },
        select: { id: true },
      }),
    ]);
    userId = user.id;
    otherUserId = otherUser.id;

    await fixturePrisma.comment.createMany({
      data: [
        {
          body: "included active comment",
          createdAt: new Date("2026-03-01T15:59:00.000Z"),
          sectionId: section.id,
          status: "active",
          userId,
        },
        {
          body: "included softbanned comment",
          createdAt: new Date("2026-03-01T16:00:00.000Z"),
          sectionId: section.id,
          status: "softbanned",
          userId,
        },
        {
          body: "excluded deleted comment",
          createdAt: new Date("2026-03-01T17:00:00.000Z"),
          sectionId: section.id,
          status: "deleted",
          userId,
        },
        {
          body: "excluded before lower bound",
          createdAt: new Date("2025-03-02T15:59:59.999Z"),
          sectionId: section.id,
          status: "active",
          userId,
        },
      ],
    });
    await fixturePrisma.comment.create({
      data: {
        body: "other user softbanned comment",
        createdAt: new Date("2026-03-04T16:00:00.000Z"),
        sectionId: section.id,
        status: "softbanned",
        userId: otherUserId,
      },
    });

    await fixturePrisma.upload.createMany({
      data: [
        {
          createdAt: startAt,
          filename: "lower-bound.txt",
          key: `profile-contributions/${marker}/lower-bound`,
          size: 1,
          userId,
        },
        ...Array.from({ length: 20 }, (_, index) => ({
          createdAt: new Date("2026-03-01T16:15:00.000Z"),
          filename: `same-day-${index}.txt`,
          key: `profile-contributions/${marker}/same-day-${index}`,
          size: 1,
          userId,
        })),
        {
          createdAt: new Date("2026-03-10T00:00:00.000Z"),
          filename: "future.txt",
          key: `profile-contributions/${marker}/future`,
          size: 1,
          userId,
        },
      ],
    });

    const includedHomework = await fixturePrisma.homework.create({
      data: {
        createdAt: new Date("2026-03-01T18:00:00.000Z"),
        createdById: userId,
        sectionId: section.id,
        title: "included authored homework",
      },
      select: { id: true },
    });
    await Promise.all([
      fixturePrisma.homework.create({
        data: {
          createdAt: new Date("2026-03-01T19:00:00.000Z"),
          createdById: userId,
          deletedAt: new Date("2026-03-01T19:30:00.000Z"),
          sectionId: section.id,
          title: "excluded deleted homework",
        },
      }),
      fixturePrisma.homeworkCompletion.create({
        data: {
          completedAt: new Date("2026-03-01T20:00:00.000Z"),
          homeworkId: includedHomework.id,
          userId,
        },
      }),
    ]);
  });

  afterAll(async () => {
    if (userId) {
      await fixturePrisma.homeworkCompletion.deleteMany({ where: { userId } });
      await fixturePrisma.comment.deleteMany({ where: { userId } });
      await fixturePrisma.upload.deleteMany({ where: { userId } });
      await fixturePrisma.homework.deleteMany({
        where: { createdById: userId },
      });
      await fixturePrisma.user.deleteMany({ where: { id: userId } });
    }
    if (otherUserId) {
      await fixturePrisma.comment.deleteMany({
        where: { userId: otherUserId },
      });
      await fixturePrisma.user.deleteMany({ where: { id: otherUserId } });
    }
    await Promise.all([
      runtimePrisma.$disconnect(),
      disconnectTestPrisma(fixturePrisma),
    ]);
  });

  it("returns one aggregate row per Shanghai day across public contribution sources", async () => {
    await expect(
      runtimePrisma.comment.findMany({
        where: { status: "softbanned", userId },
        select: { id: true },
      }),
    ).resolves.toEqual([]);
    await expect(
      runtimePrisma.$queryRaw<
        Array<{ count: bigint; date: string }>
      >`SELECT * FROM public.get_public_profile_comment_contribution_days(${userId}, ${startAt})`,
    ).resolves.toEqual([
      { count: 1n, date: "2026-03-01" },
      { count: 1n, date: "2026-03-02" },
    ]);
    await expect(
      loadUserProfileContributionDays(runtimePrisma, userId, startAt),
    ).resolves.toEqual([
      { count: 1, date: "2025-03-03" },
      { count: 1, date: "2026-03-01" },
      { count: 22, date: "2026-03-02" },
      { count: 1, date: "2026-03-10" },
    ]);
  });

  it("isolates comment contribution aggregates between profile owners", async () => {
    await expect(
      runtimePrisma.comment.findMany({
        where: { status: "softbanned", userId: otherUserId },
        select: { id: true },
      }),
    ).resolves.toEqual([]);

    await expect(
      loadUserProfileContributionDays(runtimePrisma, otherUserId, startAt),
    ).resolves.toEqual([{ count: 1, date: "2026-03-05" }]);
  });

  it("preserves the week grid and totals events beyond its visible end", async () => {
    const result = await buildUserProfileContributions(
      runtimePrisma,
      userId,
      referenceNow,
    );
    const cells = new Map(
      result.weeks.flat().map((cell) => [cell.date, cell.count]),
    );

    expect(result.totalContributions).toBe(25);
    expect(result.weeks[0]?.[0]?.date).toBe("2025-03-02");
    expect(result.weeks.at(-1)?.at(-1)?.date).toBe("2026-03-07");
    expect(cells.get("2025-03-03")).toBe(1);
    expect(cells.get("2026-03-01")).toBe(1);
    expect(cells.get("2026-03-02")).toBe(22);
    expect(cells.has("2026-03-10")).toBe(false);
  });
});
