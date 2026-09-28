import type { Page } from "@playwright/test";
import type {
  Comment,
  Course,
  Description,
  Homework,
  Section,
  User,
} from "../../../src/generated/prisma-node/client";
import type { TestPrismaClient } from "../../shared/prisma";
import { test as adminTest } from "./admin-fixture";

type ModerationFixture = {
  admin: User;
  author: User;
  authorPage: Page;
  marker: string;
  comment: Comment;
  description: Description;
  homework: Homework;
  course: Course;
  section: Section;
  db: TestPrismaClient;
};

// Global moderation queues are capped before browser-side search. Each case
// therefore owns a complete Worker/database, including its audit writes.
export const test = adminTest.extend<{ moderation: ModerationFixture }>({
  moderation: async ({ isolatedWorker, admin, browser }, use) => {
    const author = await isolatedWorker.createActor();
    const db = isolatedWorker.database.owner;
    const marker = `moderation-${crypto.randomUUID()}`;
    const records = await db.$transaction(async (tx) => {
      const semester = await tx.semester.create({
        data: { jwId: 1, nameCn: "独立审核学期", code: "moderation" },
      });
      const course = await tx.course.create({
        data: {
          jwId: 1,
          code: `CM${marker}`,
          nameCn: `独立社区课程 ${marker}`,
          nameEn: `Independent community course ${marker}`,
        },
      });
      const section = await tx.section.create({
        data: {
          jwId: 1,
          code: `CM${marker}.01`,
          courseId: course.id,
          semesterId: semester.id,
        },
      });
      const homework = await tx.homework.create({
        data: {
          sectionId: section.id,
          title: marker,
          createdById: author.id,
        },
      });
      const comment = await tx.comment.create({
        data: {
          sectionId: section.id,
          userId: author.id,
          body: marker,
        },
      });
      const description = await tx.description.create({
        data: {
          courseId: course.id,
          content: marker,
          lastEditedById: author.id,
        },
      });
      return {
        admin: await tx.user.findUniqueOrThrow({ where: { id: admin.id } }),
        author: await tx.user.findUniqueOrThrow({ where: { id: author.id } }),
        homework,
        comment,
        description,
        course,
        section,
      };
    });
    const context = await browser.newContext({
      baseURL: isolatedWorker.origin,
    });
    try {
      await context.addCookies([author.cookie]);
      const authorPage = await context.newPage();
      await use({ ...records, authorPage, marker, db });
    } finally {
      await context.close();
    }
  },
});
