import { expect } from "@playwright/test";
import type { TestPrismaClient } from "../../../../../shared/prisma";
import { test as subscriptionTest } from "../../../../utils/catalog-subscription-fixture";

async function arrangePresentation(db: TestPrismaClient) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: "Subscription presentation viewer",
        username: "subscription-presentation",
        email: "subscription-presentation@example.test",
        emailVerified: true,
      },
    });
    const course = await tx.course.create({
      data: {
        jwId: 1_700_000_000,
        code: "IS3003",
        nameCn: "密码工程原理与实践",
        nameEn: "Cryptographic Engineering: Principles and Practice",
      },
    });
    const teacher = await tx.teacher.create({
      data: {
        jwId: 1_700_000_000,
        nameCn: "林璟锵",
        nameEn: "Lin Jingqiang",
      },
    });
    const semesters = [];
    for (const data of [
      {
        jwId: 2,
        code: "421",
        nameCn: "2026年春季学期",
        startDate: new Date("2026-02-01T00:00:00+08:00"),
        endDate: new Date("2026-07-31T23:59:59+08:00"),
      },
      {
        jwId: 1,
        code: "420",
        nameCn: "2025年秋季学期",
        startDate: new Date("2025-09-01T00:00:00+08:00"),
        endDate: new Date("2026-01-31T23:59:59+08:00"),
      },
    ]) {
      semesters.push(await tx.semester.create({ data }));
    }
    const sections = [];
    for (const index of [0, 1, 2]) {
      const section = await tx.section.create({
        data: {
          jwId: 1_700_000_000 + index,
          code: `subscription-view-fixture0.${index + 1}`,
          courseId: course.id,
          semesterId: semesters[index < 2 ? 0 : 1].id,
          teachers: { connect: { id: teacher.id } },
          credits: 2.5,
        },
      });
      sections.push(section);
      await tx.userSectionSubscription.create({
        data: { userId: user.id, sectionId: section.id, kind: "regular" },
      });
    }
    return { user, course, teacher, semesters, sections };
  });
}

export const test = subscriptionTest.extend<{
  presentation: Awaited<ReturnType<typeof arrangePresentation>>;
}>({
  presentation: async ({ isolatedWorker, run }, use) => {
    const presentation = await run(() =>
      arrangePresentation(isolatedWorker.database.owner),
    );
    expect(presentation.semesters).toHaveLength(2);
    await use(presentation);
  },
});
