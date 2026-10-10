import { describe } from "vitest";
import {
  buildUserProfileContributions,
  loadPublicProfileUploadCount,
  loadUserProfileContributionDays,
} from "@/features/profile/server/user-profile-contributions";
import { getUserProfileById } from "@/features/profile/server/user-profile-page-data";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { nodeProtocolTest } from "../shared/node-protocol-fixture";

const it = nodeProtocolTest.extend(
  "profile",
  async ({ isolatedDatabase: { owner: fixturePrisma }, protocolRuntime }) =>
    protocolRuntime.run(async () => {
      const referenceNow = new Date("2026-03-02T01:30:00+08:00");
      const startAt = new Date("2025-03-02T16:00:00.000Z");
      const graph = await fixturePrisma.$transaction(async (tx) => {
        const marker = crypto.randomUUID();
        const course = await tx.course.create({
          data: {
            jwId: 1,
            code: marker,
            nameCn: "Profile contribution course",
          },
        });
        const section = await tx.section.create({
          data: { jwId: 1, code: marker, courseId: course.id },
        });
        const sectionId = section.id;
        const [user, otherUser] = await Promise.all([
          tx.user.create({
            data: {
              email: `profile-contributions-${marker}@example.test`,
              name: "Profile contribution integration",
              username: `profile-contributions-${marker}`,
            },
            select: { id: true },
          }),
          tx.user.create({
            data: {
              email: `profile-contributions-other-${marker}@example.test`,
              name: "Other profile contribution integration",
              username: `profile-contributions-other-${marker}`,
            },
            select: { id: true },
          }),
        ]);
        const userId = user.id;
        const otherUserId = otherUser.id;

        await tx.comment.createMany({
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
        await tx.comment.create({
          data: {
            body: "other user public comment",
            createdAt: new Date("2026-03-04T16:00:00.000Z"),
            sectionId: section.id,
            status: "active",
            userId: otherUserId,
          },
        });

        await tx.upload.createMany({
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

        const publicComment = await tx.comment.findFirstOrThrow({
          where: { userId, status: "active", body: "included active comment" },
        });
        const publicUploads = await tx.upload.findMany({
          where: { userId },
        });
        await tx.commentAttachment.createMany({
          data: publicUploads.map((upload) => ({
            commentId: publicComment.id,
            uploadId: upload.id,
          })),
        });

        const includedHomework = await tx.homework.create({
          data: {
            createdAt: new Date("2026-03-01T18:00:00.000Z"),
            createdById: userId,
            sectionId: section.id,
            title: "included authored homework",
          },
          select: { id: true },
        });
        const homeworkId = includedHomework.id;
        await Promise.all([
          tx.homework.create({
            data: {
              createdAt: new Date("2026-03-01T19:00:00.000Z"),
              createdById: userId,
              deletedAt: new Date("2026-03-01T19:30:00.000Z"),
              sectionId: section.id,
              title: "excluded deleted homework",
            },
          }),
          tx.homeworkCompletion.create({
            data: {
              completedAt: new Date("2026-03-01T20:00:00.000Z"),
              homeworkId: includedHomework.id,
              userId,
            },
          }),
        ]);
        return { userId, otherUserId, sectionId, homeworkId };
      });
      return {
        ...graph,
        startAt,
        referenceNow,
        // Explicit oracle: one lower-bound upload, one named comment, twenty
        // same-day uploads plus one homework, and one future upload.
        baselineDays: [
          { count: 1, date: "2025-03-03" },
          { count: 1, date: "2026-03-01" },
          { count: 21, date: "2026-03-02" },
          { count: 1, date: "2026-03-10" },
        ],
      };
    }),
);

describe("public profile contribution aggregation", () => {
  it("user.public-comment-contribution-privacy", {
    tags: ["@User/Service"],
  }, async ({
    profile: contributionFixture,
    isolatedDatabase: { owner: fixturePrisma },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const { userId, sectionId, startAt, baselineDays } = contributionFixture;
      const expected = baselineDays;
      expect(
        await protocolRuntime.request(() =>
          loadUserProfileContributionDays(runtimePrisma, userId, startAt),
        ),
      ).toEqual(expected);
      const cases = [
        { status: "softbanned" as const },
        { status: "deleted" as const },
        { visibility: "logged_in_only" as const },
        { isAnonymous: true },
        { deletedAt: new Date() },
      ];
      for (const attributes of cases) {
        await fixturePrisma.comment.create({
          data: {
            body: "Excluded profile contribution",
            sectionId,
            userId,
            createdAt: new Date("2026-03-06T12:00:00Z"),
            ...attributes,
          },
        });
        expect(
          await protocolRuntime.request(() =>
            loadUserProfileContributionDays(runtimePrisma, userId, startAt),
          ),
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
      expect(
        await protocolRuntime.request(() =>
          loadUserProfileContributionDays(runtimePrisma, userId, startAt),
        ),
      ).toContainEqual({ date: "2026-03-06", count: 1 });
      const profile = await protocolRuntime.request(() =>
        getUserProfileById(userId),
      );
      expect(profile?.user._count.comments).toBe(3); // two baseline named rows plus this one, regardless of date window
      await fixturePrisma.comment.update({
        where: { id: named.id },
        data: { isAnonymous: true },
      });
      expect(
        await protocolRuntime.request(() =>
          loadUserProfileContributionDays(runtimePrisma, userId, startAt),
        ),
      ).toEqual(expected);
      expect(
        (await protocolRuntime.request(() => getUserProfileById(userId)))?.user
          ._count.comments,
      ).toBe(2);
    });
  });

  it("user.public-upload-contribution-privacy", {
    tags: ["@User/Service"],
  }, async ({
    profile: contributionFixture,
    isolatedDatabase: { owner: fixturePrisma },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const { userId, sectionId, startAt, baselineDays } = contributionFixture;
      const expected = 22;
      const expectedDays = baselineDays;
      expect(
        await protocolRuntime.request(() =>
          loadPublicProfileUploadCount(runtimePrisma, userId, startAt),
        ),
      ).toBe(expected);
      expect(
        await protocolRuntime.request(() =>
          loadUserProfileContributionDays(runtimePrisma, userId, startAt),
        ),
      ).toEqual(expectedDays);
      const uploads: string[] = [];
      for (const attributes of [
        null,
        { status: "softbanned" as const },
        { status: "deleted" as const },
        { visibility: "logged_in_only" as const },
        { isAnonymous: true },
        { deletedAt: new Date() },
      ]) {
        const upload = await fixturePrisma.$transaction(async (tx) => {
          const upload = await tx.upload.create({
            data: {
              userId,
              key: `profile-privacy/${crypto.randomUUID()}`,
              filename: "private.txt",
              size: 1,
              createdAt: new Date("2026-03-06T12:00:00Z"),
            },
          });
          if (attributes) {
            await tx.comment.create({
              data: {
                userId,
                sectionId,
                body: "Excluded attachment",
                createdAt: new Date("2026-03-06T12:00:00Z"),
                ...attributes,
                attachments: { create: { uploadId: upload.id } },
              },
            });
          }
          return upload;
        });
        uploads.push(upload.id);
        expect(
          await protocolRuntime.request(() =>
            loadPublicProfileUploadCount(runtimePrisma, userId, startAt),
          ),
        ).toBe(expected);
        expect(
          await protocolRuntime.request(() =>
            loadUserProfileContributionDays(runtimePrisma, userId, startAt),
          ),
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
      expect(
        await protocolRuntime.request(() =>
          loadPublicProfileUploadCount(runtimePrisma, userId, startAt),
        ),
      ).toBe(expected + 1);
      expect(
        await protocolRuntime.request(() =>
          loadUserProfileContributionDays(runtimePrisma, userId, startAt),
        ),
      ).toContainEqual({ date: "2026-03-06", count: 2 });
      await fixturePrisma.comment.update({
        where: { id: attached.id },
        data: { visibility: "logged_in_only" },
      });
      expect(
        await protocolRuntime.request(() =>
          loadPublicProfileUploadCount(runtimePrisma, userId, startAt),
        ),
      ).toBe(expected);
      expect(
        await protocolRuntime.request(() =>
          loadUserProfileContributionDays(runtimePrisma, userId, startAt),
        ),
      ).toEqual(expectedDays);
    });
  });

  it("user.private-workspace-profile-exclusion", {
    tags: ["@User/Service"],
  }, async ({
    profile: contributionFixture,
    isolatedDatabase: { owner: fixturePrisma },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const { userId, sectionId, homeworkId } = contributionFixture;
      const before = await protocolRuntime.request(() =>
        getUserProfileById(userId),
      );
      expect(before).not.toHaveProperty("sectionCount");
      expect(before?.user._count).not.toHaveProperty("subscribedSections");
      expect(before?.user._count).toMatchObject({
        comments: 2,
        homeworksCreated: 1,
      });
      await fixturePrisma.$transaction(async (tx) => {
        await tx.userSectionSubscription.create({
          data: { userId, sectionId },
        });
        await tx.homeworkCompletion.deleteMany({
          where: { userId, homeworkId },
        });
      });
      expect(
        await protocolRuntime.request(() => getUserProfileById(userId)),
      ).toEqual(before);
      await fixturePrisma.homeworkCompletion.create({
        data: { userId, homeworkId },
      });
      expect(
        await protocolRuntime.request(() => getUserProfileById(userId)),
      ).toEqual(before);
      const [row] = await protocolRuntime.request(
        () => runtimePrisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT to_regprocedure('public.get_public_profile_section_subscription_count(text)') IS NOT NULL AS "exists"
      `,
      );
      expect(row.exists).toBe(false);
    });
  });

  it("returns one aggregate row per Shanghai day across public contribution sources", {
    tags: ["@User/Service"],
  }, async ({ profile: contributionFixture, protocolRuntime, expect }) => {
    await protocolRuntime.run(async () => {
      const { userId, startAt } = contributionFixture;
      await expect(
        protocolRuntime.request(() =>
          runtimePrisma.comment.findMany({
            where: { status: "softbanned", userId },
            select: { id: true },
          }),
        ),
      ).resolves.toEqual([]);
      await expect(
        protocolRuntime.request(
          () =>
            runtimePrisma.$queryRaw<
              Array<{ count: bigint; date: string }>
            >`SELECT * FROM public.get_public_profile_comment_contribution_days(${userId}, ${startAt})`,
        ),
      ).resolves.toEqual([{ count: 1n, date: "2026-03-01" }]);
      await expect(
        protocolRuntime.request(() =>
          loadUserProfileContributionDays(runtimePrisma, userId, startAt),
        ),
      ).resolves.toEqual([
        { count: 1, date: "2025-03-03" },
        { count: 1, date: "2026-03-01" },
        { count: 21, date: "2026-03-02" },
        { count: 1, date: "2026-03-10" },
      ]);
    });
  });

  it("isolates comment contribution aggregates between profile owners", {
    tags: ["@User/Service"],
  }, async ({ profile: contributionFixture, protocolRuntime, expect }) => {
    await protocolRuntime.run(async () => {
      const { otherUserId, startAt } = contributionFixture;
      await expect(
        protocolRuntime.request(() =>
          runtimePrisma.comment.findMany({
            where: { status: "softbanned", userId: otherUserId },
            select: { id: true },
          }),
        ),
      ).resolves.toEqual([]);

      await expect(
        protocolRuntime.request(() =>
          loadUserProfileContributionDays(runtimePrisma, otherUserId, startAt),
        ),
      ).resolves.toEqual([{ count: 1, date: "2026-03-05" }]);
    });
  });

  it("user.public-contribution-window", { tags: ["@User/Service"] }, async ({
    profile: contributionFixture,
    isolatedDatabase: { owner: fixturePrisma },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const { userId, sectionId, referenceNow } = contributionFixture;
      await fixturePrisma.comment.create({
        data: {
          userId,
          sectionId,
          status: "active",
          visibility: "public",
          body: "Future day within final padded week",
          createdAt: new Date("2026-03-02T16:00:00.000Z"),
        },
      });
      const result = await protocolRuntime.request(() =>
        buildUserProfileContributions(runtimePrisma, userId, referenceNow),
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
    });
  });
});
