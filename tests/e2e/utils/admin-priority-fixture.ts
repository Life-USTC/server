import { withE2ePrisma } from "./e2e-db/prisma";

export async function createAdminPriorityFixture() {
  return withE2ePrisma(async (db) => {
    const marker = crypto.randomUUID();
    const base = 1_300_000_000 + Math.floor(Math.random() * 100_000_000);
    const admin = await db.user.create({
      data: {
        name: "Priority administrator",
        username: "priorityadmin",
        email: "priority-admin@example.test",
        isAdmin: true,
      },
    });
    const author = await db.user.create({
      data: {
        name: "Priority review author",
        username: "priorityauthor",
        email: "priority-author@example.test",
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
    });
    const course = await db.course.create({
      data: {
        jwId: base,
        code: "PRIORITY",
        nameCn: "优先级验收课程",
        nameEn: "Priority review course",
      },
    });
    const section = await db.section.create({
      data: { jwId: base + 1, courseId: course.id, code: "PRIORITY.01" },
    });
    await db.userSuspension.create({
      data: {
        userId: author.id,
        createdById: admin.id,
        reason: "Priority review suspension",
        expiresAt: new Date("2099-01-01T00:00:00Z"),
      },
    });
    const comment = await db.comment.create({
      data: {
        userId: author.id,
        sectionId: section.id,
        body: "Priority review comment content",
        createdAt: new Date("2026-01-03T00:00:00Z"),
        status: "softbanned",
        moderationNote: "Priority review note",
      },
    });
    const description = await db.description.create({
      data: {
        courseId: course.id,
        content: "Priority review description content",
        lastEditedById: author.id,
        lastEditedAt: new Date("2026-01-04T00:00:00Z"),
        updatedAt: new Date("2026-01-06T00:00:00Z"),
      },
    });
    const fallbackDescription = await db.description.create({
      data: {
        sectionId: section.id,
        content: "Priority review fallback description",
        lastEditedById: author.id,
        lastEditedAt: null,
        updatedAt: new Date("2026-01-07T00:00:00Z"),
      },
    });
    const homework = await db.homework.create({
      data: {
        sectionId: section.id,
        createdById: author.id,
        title: "Priority review homework title",
        createdAt: new Date("2026-01-05T00:00:00Z"),
        submissionDueAt: new Date("2026-12-01T00:00:00Z"),
      },
    });
    const client = await db.oAuthClient.create({
      data: {
        clientId: "priority-review-client",
        name: "Priority review application",
        userId: admin.id,
        public: true,
        tokenEndpointAuthMethod: "none",
        skipConsent: false,
        scopes: ["catalog:read"],
        redirectUris: ["https://example.test/callback"],
        grantTypes: ["authorization_code"],
        createdAt: new Date("2026-01-08T00:00:00Z"),
      },
    });
    const bus = await db.busScheduleVersion.create({
      data: {
        id: base + 2,
        key: "priority-review-timetable",
        checksum: marker,
        title: "Priority review timetable",
        sourceMessage: "Priority review schedule source",
        isEnabled: false,
        importedAt: new Date("2026-01-09T00:00:00Z"),
        effectiveFrom: new Date("2026-02-01T00:00:00Z"),
        effectiveUntil: new Date("2026-12-31T00:00:00Z"),
        rawJson: {},
      },
    });
    return {
      admin,
      author,
      course,
      section,
      comment,
      description,
      fallbackDescription,
      homework,
      client,
      bus,
    };
  });
}

export type AdminPriorityFixture = Awaited<
  ReturnType<typeof createAdminPriorityFixture>
>;

export async function cleanupAdminPriorityFixture(f: AdminPriorityFixture) {
  await withE2ePrisma(async (db) => {
    await db.busScheduleVersion.delete({ where: { id: f.bus.id } });
    await db.section.delete({ where: { id: f.section.id } });
    await db.course.delete({ where: { id: f.course.id } });
    await db.user.deleteMany({
      where: { id: { in: [f.admin.id, f.author.id] } },
    });
  });
}
