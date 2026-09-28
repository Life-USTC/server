import { randomInt } from "node:crypto";
import type { BrowserContext } from "@playwright/test";
import type { Comment, User } from "../../../src/generated/prisma-node/client";
import { DEV_SEED } from "./dev-seed";
import { withE2ePrisma } from "./e2e-db/prisma";
import { test as accountTest } from "./isolated-account";
import { createSignedSessionCookie } from "./workspace-task-filters";

type Target = {
  type: "course" | "section" | "teacher";
  id: number;
  path: string;
};
type Catalog = {
  course: { id: number; jwId: number };
  section: { id: number; jwId: number };
  teacher: { id: number };
  targets: Target[];
};
export const supplement = "Independent community supplement";
export const discussion = "Independent community discussion";

export const test = accountTest.extend<{
  community: Catalog;
  presentation: Catalog;
  comment: Comment;
  audiences: { users: User[]; contexts: BrowserContext[] };
}>({
  community: async ({ page }, use) => {
    const marker = crypto.randomUUID();
    const jwId = randomInt(1_800_000_000, 1_900_000_000);
    const records = await withE2ePrisma((db) =>
      db.$transaction(async (tx) => {
        const semester = await tx.semester.findUniqueOrThrow({
          where: { jwId: DEV_SEED.semesterJwId },
        });
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
    try {
      await use({
        ...records,
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
    } finally {
      try {
        await Promise.all(
          page
            .context()
            .pages()
            .map((openPage) => openPage.close()),
        );
      } finally {
        await withE2ePrisma((db) =>
          db.$transaction([
            db.section.delete({ where: { id: section.id } }),
            db.course.delete({ where: { id: course.id } }),
            db.teacher.delete({ where: { id: teacher.id } }),
          ]),
        );
      }
    }
  },
  presentation: async ({ account, community }, use) => {
    await withE2ePrisma((db) =>
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
  comment: async ({ account, community }, use) => {
    await use(
      await withE2ePrisma((db) =>
        db.comment.create({
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
    { account, community: _community, browser, page, baseURL },
    use,
  ) => {
    const peers = await withE2ePrisma((db) =>
      db.$transaction(async (tx) => {
        const peers = [];
        for (const role of ["viewer", "admin"]) {
          const marker = crypto.randomUUID();
          peers.push(
            await tx.user.create({
              data: {
                name: `Private catalog ${role}`,
                username: `cp${marker.replaceAll("-", "").slice(0, 17)}`,
                email: `community-${marker}@example.test`,
                isAdmin: role === "admin",
              },
            }),
          );
        }
        return peers;
      }),
    );
    const contexts: BrowserContext[] = [page.context()];
    try {
      for (const user of [...peers, null]) {
        const context = await browser.newContext({ baseURL });
        contexts.push(context);
        if (user)
          await context.addCookies([await createSignedSessionCookie(user.id)]);
      }
      await use({ users: [account, ...peers], contexts });
    } finally {
      try {
        await Promise.all(contexts.slice(1).map((context) => context.close()));
      } finally {
        const ids = peers.map((user) => user.id);
        await withE2ePrisma((db) =>
          db.$transaction([
            db.auditLog.deleteMany({
              where: {
                OR: [{ userId: { in: ids } }, { subjectUserId: { in: ids } }],
              },
            }),
            db.user.deleteMany({ where: { id: { in: ids } } }),
          ]),
        );
      }
    }
  },
});

export function storedComment(id: string) {
  return withE2ePrisma((db) =>
    db.comment.findUnique({ where: { id }, include: { reactions: true } }),
  );
}

export function arrangeDescription(
  targetType: Target["type"],
  targetId: number,
  editorId: string,
) {
  return withE2ePrisma((db) =>
    db.description.create({
      data: {
        [`${targetType}Id`]: targetId,
        content: supplement,
        lastEditedById: editorId,
      },
    }),
  );
}

export function storedDescription(id: string) {
  return withE2ePrisma((db) =>
    db.description.findUnique({ where: { id }, include: { edits: true } }),
  );
}

export function storedDescriptionAudits(id: string) {
  return withE2ePrisma((db) =>
    db.auditLog.findMany({
      where: {
        targetId: id,
        targetType: "description",
        action: "description_edit",
      },
    }),
  );
}
