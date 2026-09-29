import type { BrowserContext } from "@playwright/test";
import type {
  Comment,
  Semester,
  User,
} from "../../../src/generated/prisma-node/client";
import type { TestPrismaClient } from "../../shared/prisma";
import { type CommunityFlow, withCommunityFlow } from "./community-flow";
import { DEV_SEED } from "./dev-seed";
import { test as accountTest } from "./owned-worker";

type Target = {
  type: "course" | "section" | "teacher";
  id: number;
  path: string;
};
type Catalog = {
  db: TestPrismaClient;
  semesters: { current: Semester; previous: Semester };
  course: { id: number; jwId: number };
  section: { id: number; jwId: number };
  teacher: { id: number };
  targets: Target[];
};
export const supplement = "Independent community supplement";
export const discussion = "Independent community discussion";

export const test = accountTest.extend<{
  account: User;
  communityFlow: CommunityFlow;
  communitySemesters: { current: Semester; previous: Semester };
  community: Catalog;
  presentation: Catalog;
  comment: Comment;
  audiences: { users: User[]; contexts: BrowserContext[] };
}>({
  account: async (
    { isolatedWorker, page, run, communitySemesters: _semesters },
    use,
  ) => {
    const actor = await run(() => isolatedWorker.createActor());
    await page.context().addCookies([actor.cookie]);
    await use(
      await run(() =>
        isolatedWorker.database.owner.user.findUniqueOrThrow({
          where: { id: actor.id },
        }),
      ),
    );
  },
  communitySemesters: async ({ isolatedWorker, run }, use) => {
    const anchor = new Date().getTime();
    const dateAt = (days: number) => new Date(anchor + days * 86_400_000);
    await use(
      await run(() =>
        isolatedWorker.database.owner.$transaction(async (db) => ({
          current: await db.semester.create({
            data: {
              jwId: DEV_SEED.semesterJwId,
              code: "421",
              nameCn: DEV_SEED.semesterNameCn,
              startDate: dateAt(-30),
              endDate: dateAt(180),
            },
          }),
          previous: await db.semester.create({
            data: {
              jwId: DEV_SEED.previousSemesterJwId,
              code: "420",
              nameCn: DEV_SEED.previousSemesterNameCn,
              startDate: dateAt(-240),
              endDate: dateAt(-60),
            },
          }),
        })),
      ),
    );
  },
  communityFlow: async (
    { page, browser, request: observer, isolatedWorker, account, run },
    use,
    testInfo,
  ) => {
    await run(() =>
      withCommunityFlow(
        { page, browser, observer, isolatedWorker, account, testInfo },
        use,
      ),
    );
  },
  community: async (
    { isolatedWorker, communitySemesters: semesters, run },
    use,
  ) => {
    const db = isolatedWorker.database.owner;
    const marker = crypto.randomUUID();
    const jwId = 1_800_000_000;
    const records = await run(() =>
      db.$transaction(async (tx) => {
        const semester = semesters.current;
        const course = await tx.course.create({
          data: {
            jwId,
            code: `CM${marker}`,
            nameCn: `独立社区课程 ${marker}`,
            nameEn: `Independent community course ${marker}`,
          },
        });
        const teacher = await tx.teacher.create({
          data: {
            jwId: -jwId,
            nameCn: `社区教师 ${marker}`,
            nameEn: `Community teacher ${marker}`,
          },
        });
        const section = await tx.section.create({
          data: {
            jwId,
            code: `CM${marker}.01`,
            courseId: course.id,
            semesterId: semester.id,
            teachers: { connect: { id: teacher.id } },
          },
        });
        return { course, section, teacher };
      }),
    );
    const { course, section, teacher } = records;
    await use({
      ...records,
      db,
      semesters,
      targets: [
        {
          type: "course",
          id: course.id,
          path: `/catalog/courses/${course.jwId}`,
        },
        {
          type: "section",
          id: section.id,
          path: `/catalog/sections/${section.jwId}`,
        },
        {
          type: "teacher",
          id: teacher.id,
          path: `/catalog/teachers/${teacher.id}`,
        },
      ],
    });
  },
  presentation: async ({ account, community, run }, use) => {
    const db = community.db;
    await run(() =>
      db.$transaction(async (tx) => {
        for (const target of community.targets) {
          const relation = { [`${target.type}Id`]: target.id };
          await tx.description.create({
            data: {
              ...relation,
              content: `**${supplement}**`,
              lastEditedById: account.id,
              lastEditedAt: new Date("2026-09-20T08:00:00Z"),
              edits: {
                create: {
                  editorId: account.id,
                  previousContent: "Before supplement",
                  nextContent: `**${supplement}**`,
                },
              },
            },
          });
          await tx.comment.create({
            data: {
              ...relation,
              userId: account.id,
              body: `**${discussion}**`,
            },
          });
        }
      }),
    );
    await use(community);
  },
  comment: async ({ account, community, run }, use) => {
    await use(
      await run(() =>
        community.db.comment.create({
          data: {
            sectionId: community.section.id,
            userId: account.id,
            body: discussion,
          },
        }),
      ),
    );
  },
  audiences: async (
    { account, community, communityFlow, isolatedWorker, page, run },
    use,
  ) => {
    const peers = await run(() =>
      community.db.$transaction(async (db) => {
        const users = [];
        for (const role of ["viewer", "admin"]) {
          const marker = crypto.randomUUID();
          users.push(
            await db.user.create({
              data: {
                name: "Private catalog " + role,
                username: "cp" + marker.replaceAll("-", "").slice(0, 17),
                email: "community-" + marker + "@example.test",
                isAdmin: role === "admin",
              },
            }),
          );
        }
        return users;
      }),
    );
    const contexts = [page.context()];
    for (const user of [...peers, null]) {
      const context = await communityFlow.newContext();
      contexts.push(context);
      if (user) {
        const session = await run(() => isolatedWorker.createSession(user.id));
        await context.addCookies([session.cookie]);
      }
    }
    await use({ users: [account, ...peers], contexts });
  },
});

export function arrangeDescription(
  db: TestPrismaClient,
  targetType: Target["type"],
  targetId: number,
  editorId: string,
) {
  return db.description.create({
    data: {
      [targetType + "Id"]: targetId,
      content: supplement,
      lastEditedById: editorId,
    },
  });
}

export function storedDescription(db: TestPrismaClient, id: string) {
  return db.description.findUnique({ where: { id }, include: { edits: true } });
}

export function storedDescriptionAudits(db: TestPrismaClient, id: string) {
  return db.auditLog.findMany({
    where: {
      targetId: id,
      targetType: "description",
      action: "description_edit",
    },
  });
}
