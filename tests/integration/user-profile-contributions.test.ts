import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildUserProfileContributions,
  loadUserProfileContributionDays,
} from "@/features/profile/server/user-profile-contributions";
import { createTestPrisma, disconnectTestPrisma } from "../shared/prisma";

const prisma = createTestPrisma();
const referenceNow = new Date("2026-03-02T01:30:00+08:00");
const startAt = new Date("2025-03-02T16:00:00.000Z");

describe.sequential("public profile contribution aggregation", () => {
  let userId = "";

  beforeAll(async () => {
    const section = await prisma.section.findFirst({
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (!section) {
      throw new Error(
        "Expected the canonical integration seed to include a section",
      );
    }

    const marker = crypto.randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `profile-contributions-${marker}@example.test`,
        name: "Profile contribution integration",
        username: `profile-contributions-${marker}`,
      },
      select: { id: true },
    });
    userId = user.id;

    await prisma.comment.createMany({
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

    await prisma.upload.createMany({
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

    const includedHomework = await prisma.homework.create({
      data: {
        createdAt: new Date("2026-03-01T18:00:00.000Z"),
        createdById: userId,
        sectionId: section.id,
        title: "included authored homework",
      },
      select: { id: true },
    });
    await Promise.all([
      prisma.homework.create({
        data: {
          createdAt: new Date("2026-03-01T19:00:00.000Z"),
          createdById: userId,
          deletedAt: new Date("2026-03-01T19:30:00.000Z"),
          sectionId: section.id,
          title: "excluded deleted homework",
        },
      }),
      prisma.homeworkCompletion.create({
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
      await prisma.homeworkCompletion.deleteMany({ where: { userId } });
      await prisma.comment.deleteMany({ where: { userId } });
      await prisma.upload.deleteMany({ where: { userId } });
      await prisma.homework.deleteMany({ where: { createdById: userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await disconnectTestPrisma(prisma);
  });

  it("returns one aggregate row per Shanghai day across all four sources", async () => {
    await expect(
      loadUserProfileContributionDays(prisma, userId, startAt),
    ).resolves.toEqual([
      { count: 1, date: "2025-03-03" },
      { count: 1, date: "2026-03-01" },
      { count: 23, date: "2026-03-02" },
      { count: 1, date: "2026-03-10" },
    ]);
  });

  it("preserves the week grid and totals events beyond its visible end", async () => {
    const result = await buildUserProfileContributions(
      prisma,
      userId,
      referenceNow,
    );
    const cells = new Map(
      result.weeks.flat().map((cell) => [cell.date, cell.count]),
    );

    expect(result.totalContributions).toBe(26);
    expect(result.weeks[0]?.[0]?.date).toBe("2025-03-02");
    expect(result.weeks.at(-1)?.at(-1)?.date).toBe("2026-03-07");
    expect(cells.get("2025-03-03")).toBe(1);
    expect(cells.get("2026-03-01")).toBe(1);
    expect(cells.get("2026-03-02")).toBe(23);
    expect(cells.has("2026-03-10")).toBe(false);
  });
});
