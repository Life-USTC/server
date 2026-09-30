import { expect, type Page } from "@playwright/test";
import type {
  Comment,
  Course,
  Description,
  Homework,
  Section,
  User,
} from "../../../src/generated/prisma-node/client";
import type { TestPrismaClient } from "../../shared/prisma";
import { test as adminTest, adminWriteChecks } from "./admin-fixture";
import { withBrowserWorkflow } from "./browser-workflow";
import { withCalendarProtocol } from "./calendar-protocol-lifecycle";
import type { CommunityFlow } from "./community-flow";

type ModerationFixture = {
  admin: User;
  author: User;
  authorPage: (flow: CommunityFlow) => Promise<Page>;
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
export const test = adminTest.extend<{
  moderation: ModerationFixture;
  moderationRun: (work: () => Promise<void>) => Promise<void>;
}>({
  moderation: async ({ isolatedWorker, admin, run }, use) => {
    const state = await run(async () => {
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
      return { author, records, marker, db };
    });
    await use({
      ...state.records,
      marker: state.marker,
      db: state.db,
      async authorPage(flow) {
        const context = await flow.newContext();
        await context.addCookies([state.author.cookie]);
        return context.newPage();
      },
    });
  },
  moderationRun: async (
    { page, request: observer, playwright, isolatedWorker, moderation, run },
    use,
    testInfo,
  ) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work) =>
        workflow.run(() =>
          run(() => {
            const checks = adminWriteChecks([
              ["PATCH", `/api/admin/comments/${moderation.comment.id}`, 200],
              ["POST", "/api/admin/suspensions", 201],
              ["POST", "/admin/moderation", 200],
            ]);
            return withCalendarProtocol(
              {
                page,
                observer,
                isolatedWorker,
                testInfo,
                createRequest: (headers) =>
                  playwright.request.newContext({
                    baseURL: isolatedWorker.origin,
                    extraHTTPHeaders: headers,
                  }),
                runBody: workflow.body,
                verifyBrowserWrite: checks.verifyBrowserWrite,
              },
              async (io) => {
                await io.observeCalendar(
                  moderation.admin,
                  [{ type: "section", sectionId: moderation.section.id }],
                  { sectionId: moderation.section.id, calendar: "absent" },
                );
                await work();
                return {
                  verifyTransport: ({ effects, sdkRequests }) =>
                    checks.verifyTransport({ producer: effects, sdkRequests }),
                  async verifyState() {
                    const db = isolatedWorker.database.owner;
                    expect(
                      await db.comment.findUniqueOrThrow({
                        where: { id: moderation.comment.id },
                      }),
                    ).toMatchObject({
                      status: "softbanned",
                      moderatedById: moderation.admin.id,
                      homeworkId: moderation.homework.id,
                      sectionId: null,
                    });
                    expect(
                      await db.homework.findUniqueOrThrow({
                        where: { id: moderation.homework.id },
                      }),
                    ).toMatchObject({
                      deletedAt: expect.any(Date),
                      deletedById: moderation.admin.id,
                    });
                    expect(await db.userSuspension.findMany()).toEqual([
                      expect.objectContaining({
                        userId: moderation.author.id,
                        createdById: moderation.admin.id,
                        reason: moderation.marker,
                        liftedAt: null,
                      }),
                    ]);
                    expect(
                      (
                        await db.auditLog.findMany({
                          select: { action: true },
                          orderBy: { action: "asc" },
                        })
                      )
                        .map(({ action }) => action)
                        .sort(),
                    ).toEqual([
                      "admin_comment_moderate",
                      "admin_user_suspend",
                      "homework_delete",
                    ]);
                  },
                };
              },
            );
          }),
        ),
      );
    });
  },
});
