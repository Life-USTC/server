import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildUserProfileContributions,
  loadPublicProfileUploadCount,
  loadUserProfileContributionDays,
} from "@/features/profile/server/user-profile-contributions";
import { getUserProfileById } from "@/features/profile/server/user-profile-page-data";
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
  let sectionId = 0;
  let homeworkId = "";

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

    sectionId = section.id;
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
          body: "excluded softbanned comment",
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
        body: "other user public comment",
        createdAt: new Date("2026-03-04T16:00:00.000Z"),
        sectionId: section.id,
        status: "active",
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

    const publicComment = await fixturePrisma.comment.findFirstOrThrow({
      where: { userId, status: "active", body: "included active comment" },
    });
    const publicUploads = await fixturePrisma.upload.findMany({
      where: { userId },
    });
    await fixturePrisma.commentAttachment.createMany({
      data: publicUploads.map((upload) => ({
        commentId: publicComment.id,
        uploadId: upload.id,
      })),
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
    homeworkId = includedHomework.id;
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

  it("user.public-comment-contribution-privacy", async () => {
    const expected = await loadUserProfileContributionDays(
      runtimePrisma,
      userId,
      startAt,
    );
    const cases = [
      { status: "softbanned" as const },
      { status: "deleted" as const },
      { visibility: "logged_in_only" as const },
      { isAnonymous: true },
      { deletedAt: new Date() },
    ];
    const ids: string[] = [];
    try {
      for (const attributes of cases) {
        const comment = await fixturePrisma.comment.create({
          data: {
            body: "Excluded profile contribution",
            sectionId,
            userId,
            createdAt: new Date("2026-03-06T12:00:00Z"),
            ...attributes,
          },
        });
        ids.push(comment.id);
        expect(
          await loadUserProfileContributionDays(runtimePrisma, userId, startAt),
        ).toEqual(expected);
      }
      const named = await fixturePrisma.comment.create({
        data: {
          body: "Named public contribution",
          sectionId,
          userId,
          createdAt: new Date("2026-03-06T12:00:00Z"),
        },
      });
      ids.push(named.id);
      expect(
        await loadUserProfileContributionDays(runtimePrisma, userId, startAt),
      ).toContainEqual({ date: "2026-03-06", count: 1 });
      const profile = await getUserProfileById(userId);
      expect(profile?.user._count.comments).toBe(3); // two baseline named rows plus this one, regardless of date window
      await fixturePrisma.comment.update({
        where: { id: named.id },
        data: { isAnonymous: true },
      });
      expect(
        await loadUserProfileContributionDays(runtimePrisma, userId, startAt),
      ).toEqual(expected);
      expect((await getUserProfileById(userId))?.user._count.comments).toBe(2);
    } finally {
      await fixturePrisma.comment.deleteMany({ where: { id: { in: ids } } });
    }
  });

  it("user.public-upload-contribution-privacy", async () => {
    const expected = await loadPublicProfileUploadCount(
      runtimePrisma,
      userId,
      startAt,
    );
    const expectedDays = await loadUserProfileContributionDays(
      runtimePrisma,
      userId,
      startAt,
    );
    const comments: string[] = [];
    const uploads: string[] = [];
    try {
      for (const attributes of [
        null,
        { status: "softbanned" as const },
        { status: "deleted" as const },
        { visibility: "logged_in_only" as const },
        { isAnonymous: true },
        { deletedAt: new Date() },
      ]) {
        const upload = await fixturePrisma.upload.create({
          data: {
            userId,
            key: `profile-privacy/${crypto.randomUUID()}`,
            filename: "private.txt",
            size: 1,
            createdAt: new Date("2026-03-06T12:00:00Z"),
          },
        });
        uploads.push(upload.id);
        if (attributes) {
          const comment = await fixturePrisma.comment.create({
            data: {
              userId,
              sectionId,
              body: "Excluded attachment",
              createdAt: new Date("2026-03-06T12:00:00Z"),
              ...attributes,
              attachments: { create: { uploadId: upload.id } },
            },
          });
          comments.push(comment.id);
        }
        expect(
          await loadPublicProfileUploadCount(runtimePrisma, userId, startAt),
        ).toBe(expected);
        expect(
          await loadUserProfileContributionDays(runtimePrisma, userId, startAt),
        ).toEqual(expectedDays);
      }
      const attached = await fixturePrisma.comment.create({
        data: {
          userId,
          sectionId,
          body: "Publish attachment",
          createdAt: new Date("2026-03-06T12:00:00Z"),
          attachments: { create: { uploadId: uploads[0] } },
        },
      });
      comments.push(attached.id);
      expect(
        await loadPublicProfileUploadCount(runtimePrisma, userId, startAt),
      ).toBe(expected + 1);
      expect(
        await loadUserProfileContributionDays(runtimePrisma, userId, startAt),
      ).toContainEqual({ date: "2026-03-06", count: 2 });
      await fixturePrisma.comment.update({
        where: { id: attached.id },
        data: { visibility: "logged_in_only" },
      });
      expect(
        await loadPublicProfileUploadCount(runtimePrisma, userId, startAt),
      ).toBe(expected);
      expect(
        await loadUserProfileContributionDays(runtimePrisma, userId, startAt),
      ).toEqual(expectedDays);
    } finally {
      await fixturePrisma.comment.deleteMany({
        where: { id: { in: comments } },
      });
      await fixturePrisma.upload.deleteMany({ where: { id: { in: uploads } } });
    }
  });

  it("user.private-workspace-profile-exclusion", async () => {
    const before = await getUserProfileById(userId);
    expect(before).not.toHaveProperty("sectionCount");
    expect(before?.user._count).not.toHaveProperty("subscribedSections");
    await fixturePrisma.userSectionSubscription.create({
      data: { userId, sectionId },
    });
    await fixturePrisma.homeworkCompletion.deleteMany({
      where: { userId, homeworkId },
    });
    try {
      expect(await getUserProfileById(userId)).toEqual(before);
      await fixturePrisma.homeworkCompletion.create({
        data: { userId, homeworkId },
      });
      expect(await getUserProfileById(userId)).toEqual(before);
      const [row] = await runtimePrisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT to_regprocedure('public.get_public_profile_section_subscription_count(text)') IS NOT NULL AS "exists"
      `;
      expect(row.exists).toBe(false);
    } finally {
      await fixturePrisma.userSectionSubscription.deleteMany({
        where: { userId, sectionId },
      });
    }
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
    ).resolves.toEqual([{ count: 1n, date: "2026-03-01" }]);
    await expect(
      loadUserProfileContributionDays(runtimePrisma, userId, startAt),
    ).resolves.toEqual([
      { count: 1, date: "2025-03-03" },
      { count: 1, date: "2026-03-01" },
      { count: 21, date: "2026-03-02" },
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

  it("user.public-contribution-window", async () => {
    const tomorrow = await fixturePrisma.comment.create({
      data: {
        userId,
        sectionId,
        status: "active",
        visibility: "public",
        body: "Future day within final padded week",
        createdAt: new Date("2026-03-02T16:00:00.000Z"),
      },
    });
    try {
      const result = await buildUserProfileContributions(
        runtimePrisma,
        userId,
        referenceNow,
      );
      const cells = new Map(
        result.weeks.flat().map((cell) => [cell.date, cell.count]),
      );
      expect(result.totalContributions).toBe(23);
      expect(result.totalContributions).toBe(
        result.weeks.flat().reduce((sum, cell) => sum + cell.count, 0),
      );
      expect(result.weeks.every((week) => week.length === 7)).toBe(true);
      expect(result.weeks[0]?.[0]?.date).toBe("2025-03-02");
      expect(result.weeks.at(-1)?.at(-1)?.date).toBe("2026-03-07");
      expect(cells.get("2025-03-02")).toBe(0);
      expect(cells.get("2025-03-03")).toBe(1);
      expect(cells.get("2026-03-01")).toBe(1);
      expect(cells.get("2026-03-02")).toBe(21);
      expect(cells.get("2026-03-03")).toBe(0);
      expect(cells.has("2026-03-10")).toBe(false);
    } finally {
      await fixturePrisma.comment.delete({ where: { id: tomorrow.id } });
    }
  });
});
