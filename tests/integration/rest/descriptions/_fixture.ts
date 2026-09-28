import type { APIRequestContext } from "@playwright/test";
import type { Description } from "../../../../src/generated/prisma-node/client";
import { test as isolatedTest } from "../../../e2e/utils/isolated-worker";
import type { TestPrismaClient } from "../../../shared/prisma";

type Actor = { id: string; request: APIRequestContext };
type DescriptionState = {
  db: TestPrismaClient;
  owner: Actor;
  course: { id: number; jwId: number };
  section: { id: number; jwId: number };
  description: Description;
};
export const originalContent = "课程建议：独立测试的起始简介。";
export const base = "/api/community/descriptions";
// Description writes purge public catalog representations. Each case owns the
// real Worker/cache and database, including setup failures and deferred work.
export const test = isolatedTest.extend<{
  descriptionState: DescriptionState;
  admin: Actor;
}>({
  descriptionState: async ({ isolatedWorker }, use) => {
    const db = isolatedWorker.database.owner;
    const owner = await isolatedWorker.createActor();
    const records = await db.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          code: "private-description-course",
          jwId: 1_450_000_000,
          nameCn: "Private description course",
        },
      });
      const section = await tx.section.create({
        data: {
          code: "private-description-section",
          jwId: 1_450_000_001,
          courseId: course.id,
        },
      });
      const description = await tx.description.create({
        data: {
          sectionId: section.id,
          content: originalContent,
          lastEditedById: owner.id,
        },
      });
      return { course, section, description };
    });
    await use({ db, owner, ...records });
  },
  admin: async ({ isolatedWorker }, use) => {
    await use(await isolatedWorker.createActor({ isAdmin: true }));
  },
});

export function storedDescription(state: DescriptionState) {
  return state.db.description.findUnique({
    where: { id: state.description.id },
    include: { edits: true },
  });
}
export function storedAudits(
  state: DescriptionState,
  action: "description_edit" | "admin_description_moderate",
) {
  return state.db.auditLog.findMany({
    where: {
      targetId: state.description.id,
      targetType: "description",
      action,
    },
  });
}
