import scenario from "../fixtures/scenario.json" with { type: "json" };
import { test as accountTest } from "../utils/account-fixture";
import { DEV_SEED } from "../utils/dev-seed";
import {
  createVisualCourseCatalog,
  createVisualWorkspaceCatalog,
  type VisualCatalog,
} from "./catalog-fixture";

/** Reproduce the baseline's visible personal state without borrowing its user. */
export const test = accountTest.extend<{
  catalog: VisualCatalog;
  workspace: undefined;
}>({
  catalog: async ({ isolatedWorker }, use) => {
    await use(
      await isolatedWorker.database.owner.$transaction(
        createVisualCourseCatalog,
      ),
    );
  },
  workspace: async ({ account, catalog, isolatedWorker }, use) => {
    await isolatedWorker.database.owner.$transaction(async (tx) => {
      await createVisualWorkspaceCatalog(tx, catalog);
      const image = `https://api.dicebear.com/9.x/shapes/svg?seed=${DEV_SEED.debugAvatarSeed}`;
      await tx.user.update({
        where: { id: account.id },
        data: {
          name: DEV_SEED.debugName,
          username: DEV_SEED.debugUsername,
          image,
          profilePictures: [image],
        },
      });
      // These catalog rows and the reader's personal state belong to this case.
      const sections = await tx.section.findMany({
        where: {
          jwId: { in: DEV_SEED.sections.map((section) => section.jwId) },
        },
      });
      if (sections.length !== DEV_SEED.sections.length)
        throw new Error("Missing visual catalog sections");
      await tx.userSectionSubscription.createMany({
        data: sections.map((section) => ({
          userId: account.id,
          sectionId: section.id,
        })),
      });
      const completed = await tx.homework.findFirstOrThrow({
        where: {
          title: DEV_SEED.homeworks.completedTitle,
          sectionId: { in: sections.map((section) => section.id) },
        },
      });
      const futureCompleted = await tx.homework.findFirstOrThrow({
        where: {
          title: "线性变换证明题",
          sectionId: { in: sections.map((section) => section.id) },
        },
      });
      await tx.homeworkCompletion.createMany({
        data: [
          {
            userId: account.id,
            homeworkId: completed.id,
            completedAt: new Date("2026-04-27T13:00:00Z"),
          },
          {
            userId: account.id,
            homeworkId: futureCompleted.id,
            completedAt: new Date("2026-04-30T12:30:00Z"),
          },
        ],
      });
      await tx.todo.createMany({
        data: [
          {
            title: DEV_SEED.todos.overdueTitle,
            content: "用于验证逾期待办展示",
            completed: false,
            priority: "high" as const,
            dueAt: new Date("2026-04-28T01:00:00Z"),
          },
          {
            title: DEV_SEED.todos.dueTodayTitle,
            content: "需今日完成",
            completed: false,
            priority: "high" as const,
            dueAt: new Date("2026-04-29T15:59:00Z"),
          },
          {
            title: "三天内复习安排",
            completed: false,
            priority: "medium" as const,
            dueAt: new Date("2026-05-01T10:00:00Z"),
          },
          {
            title: "下周小组展示准备",
            completed: false,
            priority: "low" as const,
            dueAt: new Date("2026-05-06T15:59:00Z"),
          },
          {
            title: "整理课程资料",
            completed: false,
            priority: "medium" as const,
            dueAt: null,
          },
          {
            title: DEV_SEED.todos.completedTitle,
            completed: true,
            priority: "high" as const,
            dueAt: new Date("2026-04-28T12:00:00Z"),
          },
        ].map((todo) => ({ ...todo, userId: account.id })),
      });
      await tx.workspaceLinkPin.createMany({
        data: DEV_SEED.catalogLinks.pinnedSlugs.map((slug) => ({
          userId: account.id,
          slug,
        })),
      });
      await tx.catalogLinkClick.createMany({
        data: scenario.catalogLinks.clickedSlugs.map(
          ({ slug, count }, index) => ({
            userId: account.id,
            slug,
            count,
            lastClickedAt: new Date(`2026-04-29T0${index + 2}:00:00Z`),
          }),
        ),
      });
    });
    await use(undefined);
  },
});
