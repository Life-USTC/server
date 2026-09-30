import { expect } from "@playwright/test";
import type { TestPrismaClient } from "../../shared/prisma";
import { test as workerTest } from "./owned-page";

type Section = { id: number; jwId: number; path: string };

export const test = workerTest.extend<{
  sectionRun: (
    plan: {
      action: "subscribe" | "unsubscribe";
      userId: string;
      subscribedIds: number[];
    }[],
    work: () => Promise<void>,
  ) => Promise<void>;
  section: Section;
  memberSection: Section & { userId: string };
}>({
  sectionRun: async ({ pageRun, isolatedWorker, section }, use) => {
    await use(async (plan, work) => {
      let index = 0;
      await pageRun(work, async (response, request) => {
        const expected = plan[index++];
        if (!expected) throw new Error("Unexpected section subscription write");
        const url = new URL(request.url());
        expect(request.method()).toBe("POST");
        expect(url.pathname).toBe(section.path);
        expect(url.search).toBe(`?/${expected.action}`);
        expect(response.status()).toBe(200);
        expect(await response.json()).toEqual({
          type: "redirect",
          status: 303,
          location: section.path,
        });
        expect(
          await getUserSubscribedSectionIds(
            isolatedWorker.database.owner,
            expected.userId,
          ),
        ).toEqual(expected.subscribedIds);
      });
      expect(index).toBe(plan.length);
    });
  },
  section: async ({ isolatedWorker, run }, use) => {
    const section = await run(() =>
      isolatedWorker.database.owner.$transaction(async (db) => {
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
      }),
    );
    const path = `/catalog/sections/${section.jwId}`;
    await use({ ...section, path });
  },
  memberSection: async ({ isolatedWorker, page, section, run }, use) => {
    const member = await run(async () => {
      const actor = await isolatedWorker.createActor();
      await page.context().addCookies([actor.cookie]);
      return { ...section, userId: actor.id };
    });
    await use(member);
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
