import type { TestPrismaClient } from "../../shared/prisma";
import {
  test as collectionTest,
  type OtherCollectionPolicyFixture,
} from "./other-collection-policy-fixture";

import { arrangeBusTimetable } from "./personal-preferences-fixture";
import { withSettledPageWrites } from "./settled-page-writes";

export async function arrangeEmbeddedTablePolicyFixture(
  db: TestPrismaClient,
  base: OtherCollectionPolicyFixture,
) {
  const extra = await db.$transaction(async (db) => {
    const section = base.catalog.sections[0];
    const userId = base.admin.id;
    const marker = base.catalog.marker;
    await db.campus.update({
      where: { id: base.catalog.campus.id },
      data: { nameCn: "验收校区", nameEn: "Policy campus" },
    });
    await db.course.update({
      where: { id: base.catalog.courses[0].id },
      data: {
        nameCn: "内嵌集合验收课程",
        nameEn: "Embedded collection course",
        code: "EMBEDDED",
      },
    });
    await db.teacher.update({
      where: { id: base.catalog.teachers[0].id },
      data: {
        nameCn: "内嵌集合验收教师",
        nameEn: "Embedded collection teacher",
        code: "EMBEDDED-T",
      },
    });
    for (const [index, item] of base.catalog.sections.entries()) {
      await db.section.update({
        where: { id: item.id },
        data: { code: `EMBEDDED.${String(index + 1).padStart(2, "0")}` },
      });
    }
    await db.userSectionSubscription.create({
      data: { userId, sectionId: section.id },
    });
    const homework = await db.homework.create({
      data: {
        sectionId: section.id,
        createdById: userId,
        title: "Embedded table homework with a complete descriptive title",
        description: {
          create: {
            content: "Homework reading content",
            lastEditedById: userId,
          },
        },
        publishedAt: new Date(),
        submissionStartAt: new Date(),
        submissionDueAt: new Date(Date.now() + 86400000 * 3),
        isMajor: true,
        requiresTeam: true,
      },
    });
    const todo = await db.todo.create({
      data: {
        userId,
        title: "Embedded table todo with a complete descriptive title",
        content: "Todo reading content",
        priority: "high",
        dueAt: new Date(Date.now() + 86400000 * 3),
      },
    });
    await db.comment.create({
      data: {
        sectionId: section.id,
        userId: base.members[0].id,
        body: `${marker} comment with readable context`,
      },
    });
    await db.description.create({
      data: {
        courseId: base.catalog.courses[0].id,
        content: `${marker} description with readable context`,
        lastEditedById: userId,
        lastEditedAt: new Date(),
      },
    });
    await db.userSuspension.create({
      data: {
        userId: base.members[0].id,
        createdById: userId,
        reason: `${marker} moderation reason`,
        expiresAt: new Date("2099-01-01T00:00:00Z"),
      },
    });
    await db.oAuthClient.create({
      data: {
        clientId: marker,
        userId,
        name: "Table alignment application",
        public: true,
        redirectUris: ["https://example.test/callback"],
        tokenEndpointAuthMethod: "none",
        grantTypes: ["authorization_code"],
      },
    });
    await db.exam.create({
      data: {
        jwId: section.jwId + 500,
        sectionId: section.id,
        examDate: new Date(Date.now() + 86400000 * 3),
        startTime: 900,
        endTime: 1100,
        examTakeCount: 47,
        examMode: "Written",
        examRooms: { create: { room: "Table examination room", count: 47 } },
      },
    });
    const group = await db.scheduleGroup.create({
      data: {
        jwId: section.jwId + 600,
        sectionId: section.id,
        no: 1,
        limitCount: 48,
        stdCount: 12,
        actualPeriods: 2,
        isDefault: true,
      },
    });
    await db.schedule.create({
      data: {
        sectionId: section.id,
        scheduleGroupId: group.id,
        date: new Date(Date.now() + 86400000 * 3),
        weekday: 3,
        startTime: 800,
        endTime: 945,
        startUnit: 1,
        endUnit: 2,
        periods: 2,
        weekIndex: 1,
        customPlace: "Table lecture room",
      },
    });
    const bus = await db.busScheduleVersion.create({
      data: {
        key: marker,
        checksum: marker,
        title: "Table alignment timetable",
        rawJson: {},
        isEnabled: false,
      },
    });
    return { homework, todo, bus };
  });
  return { ...base, ...extra };
}

export type EmbeddedTablePolicyFixture = Awaited<
  ReturnType<typeof arrangeEmbeddedTablePolicyFixture>
>;

export const test = collectionTest.extend<{
  embedded: EmbeddedTablePolicyFixture;
  busEmbedded: EmbeddedTablePolicyFixture;
}>({
  embedded: async ({ isolatedWorker, collection }, use) => {
    await use(
      await arrangeEmbeddedTablePolicyFixture(
        isolatedWorker.database.owner,
        collection,
      ),
    );
  },
  busEmbedded: async ({ isolatedWorker, embedded, page }, use) => {
    await arrangeBusTimetable(isolatedWorker.database.owner);
    await withSettledPageWrites(
      page,
      (url) => url.pathname === "/api/workspace/bus-preferences",
      () => use(embedded),
    );
  },
});
