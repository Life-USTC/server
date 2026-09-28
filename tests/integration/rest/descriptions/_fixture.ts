import { randomInt } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import type { Description } from "../../../../src/generated/prisma-node/client";
import {
  createFixturePrisma,
  disconnectTestPrisma,
  type TestPrismaClient,
} from "../../../shared/prisma";
import { test as actorTest } from "../_harness/actor";

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
export const test = actorTest.extend<{
  descriptionState: DescriptionState;
  admin: Actor;
}>({
  descriptionState: async ({ createActor }, use) => {
    const db = createFixturePrisma();
    const marker = `rest-description-${crypto.randomUUID()}`;
    let owner: Actor | undefined;
    try {
      owner = await createActor();
      const editorId = owner.id;
      const records = await db.$transaction(async (tx) => {
        const jwId = randomInt(1_400_000_000, 1_500_000_000);
        const course = await tx.course.create({
          data: { code: marker, jwId, nameCn: marker },
        });
        const section = await tx.section.create({
          data: { code: marker, jwId: jwId + 1, courseId: course.id },
        });
        const description = await tx.description.create({
          data: {
            sectionId: section.id,
            content: originalContent,
            lastEditedById: editorId,
          },
        });
        return { course, section, description };
      });
      await use({ db, owner, ...records });
    } finally {
      try {
        await owner?.request.dispose();
      } finally {
        try {
          await db.$transaction([
            db.section.deleteMany({ where: { code: marker } }),
            db.course.deleteMany({ where: { code: marker } }),
          ]);
        } finally {
          await disconnectTestPrisma(db);
        }
      }
    }
  },
  admin: async ({ createActor, descriptionState: _state }, use) => {
    const admin = await createActor({ isAdmin: true });
    try {
      await use(admin);
    } finally {
      await admin.request.dispose();
    }
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
