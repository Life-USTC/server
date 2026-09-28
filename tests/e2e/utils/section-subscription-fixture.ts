import type { TestPrismaClient } from "../../shared/prisma";
import { test as workerTest } from "./isolated-worker";
import { withSettledPageWrites } from "./settled-page-writes";

type Section = { id: number; jwId: number; path: string };

export const test = workerTest.extend<{
  section: Section;
  memberSection: Section & { userId: string };
}>({
  section: async ({ isolatedWorker, page }, use) => {
    const section = await isolatedWorker.database.owner.$transaction(
      async (db) => {
        const semester = await db.semester.create({
          data: { jwId: 1, code: "421", nameCn: "2026年春季学期" },
        });
        const course = await db.course.create({
          data: {
            jwId: 1,
            code: "SUB1",
            nameCn: "独立订阅课程",
            nameEn: "Independent subscription course",
          },
        });
        const teacher = await db.teacher.create({
          data: {
            jwId: 1,
            nameCn: "订阅课程教师",
            nameEn: "Subscription course teacher",
          },
        });
        return db.section.create({
          data: {
            jwId: 1,
            code: "SUB1.01",
            courseId: course.id,
            semesterId: semester.id,
            teachers: { connect: { id: teacher.id } },
          },
        });
      },
    );
    const path = `/catalog/sections/${section.jwId}`;
    await withSettledPageWrites(
      page,
      (url) => url.pathname === path,
      () => use({ ...section, path }),
    );
  },
  memberSection: async ({ isolatedWorker, page, section }, use) => {
    const actor = await isolatedWorker.createActor();
    await page.context().addCookies([actor.cookie]);
    await use({ ...section, userId: actor.id });
    // The Worker owns the account and catalog until pending page writes settle,
    // then stops before its database and storage are removed.
  },
});

export async function getUserSubscribedSectionIds(
  db: TestPrismaClient,
  userId: string,
) {
  const rows = await db.userSectionSubscription.findMany({
    where: { userId },
    select: { sectionId: true },
    orderBy: { sectionId: "asc" },
  });
  return rows.map((row) => row.sectionId);
}
