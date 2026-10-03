import { nodeProtocolTest } from "./node-protocol-fixture";

/** Baseline root visibility graph owned by one original pagination case. */
export const commentPaginationTest = nodeProtocolTest.extend(
  "pagination",
  async ({ isolatedDatabase: { owner: testPrisma }, protocolRuntime }) =>
    protocolRuntime.run(async () => {
      const marker = `[integration-test] comment-root-pagination-${crypto.randomUUID()}`;
      const graph = await testPrisma.$transaction(async (tx) => {
        // SQL now() is transaction-stable. Preserve the original insertion
        // chronology explicitly so root pagination does not fall back to UUIDs.
        const startedAt = Date.now() - 6_000;
        const course = await tx.course.create({
          data: { jwId: 1, code: marker, nameCn: "Comment pagination course" },
        });
        const semester = await tx.semester.create({
          data: {
            jwId: 1,
            code: marker,
            nameCn: "Comment pagination semester",
          },
        });
        const section = await tx.section.create({
          data: {
            code: marker,
            courseId: course.id,
            jwId: 2_000_000_000 + (Date.now() % 100_000_000),
            semesterId: semester.id,
          },
          select: { id: true },
        });
        const sectionId = section.id;
        const [owner, otherUser, admin] = await Promise.all([
          tx.user.create({
            data: { email: `${marker}-owner@example.test`, name: "Owner" },
            select: { id: true },
          }),
          tx.user.create({
            data: { email: `${marker}-other@example.test`, name: "Other" },
            select: { id: true },
          }),
          tx.user.create({
            data: {
              email: `${marker}-admin@example.test`,
              isAdmin: true,
              name: "Admin",
            },
            select: { id: true },
          }),
        ]);
        const ownerId = owner.id;
        const otherUserId = otherUser.id;
        const adminId = admin.id;
        await tx.comment.create({
          data: {
            body: `${marker}-active-root`,
            createdAt: new Date(startedAt),
            sectionId,
            status: "active",
            visibility: "public",
          },
        });
        await tx.comment.create({
          data: {
            body: `${marker}-owner-softbanned-root`,
            createdAt: new Date(startedAt + 1_000),
            sectionId,
            status: "softbanned",
            userId: ownerId,
            visibility: "public",
          },
        });
        await tx.comment.create({
          data: {
            body: `${marker}-other-softbanned-root`,
            createdAt: new Date(startedAt + 2_000),
            sectionId,
            status: "softbanned",
            userId: otherUserId,
            visibility: "public",
          },
        });
        await tx.comment.create({
          data: {
            body: `${marker}-logged-in-root`,
            createdAt: new Date(startedAt + 3_000),
            sectionId,
            status: "active",
            visibility: "logged_in_only",
          },
        });
        const hiddenRoot = await tx.comment.create({
          data: {
            body: `${marker}-softbanned-root`,
            createdAt: new Date(startedAt + 4_000),
            sectionId,
            status: "softbanned",
            visibility: "public",
          },
        });
        await tx.comment.create({
          data: {
            body: `${marker}-visible-reply`,
            createdAt: new Date(startedAt + 5_000),
            parentId: hiddenRoot.id,
            rootId: hiddenRoot.id,
            sectionId,
            status: "active",
            visibility: "public",
          },
        });
        return { sectionId, ownerId, otherUserId, adminId };
      });
      return { testPrisma, marker, ...graph };
    }),
);
