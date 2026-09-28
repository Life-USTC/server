import type { APIRequestContext } from "@playwright/test";
import { DEV_SEED } from "../../../fixtures/dev-seed";
import {
  createFixturePrisma,
  type TestPrismaClient,
} from "../../../shared/prisma";
import { test as actorTest } from "../_harness/actor";

type Actor = { id: string; request: APIRequestContext };
type HomeworkState = {
  db: TestPrismaClient;
  owner: Actor;
  other: Actor;
  section: { id: number; jwId: number };
  homework: { id: string; title: string };
};
export const test = actorTest.extend<{ homeworkState: HomeworkState }>({
  homeworkState: async ({ createActor }, use) => {
    const db = createFixturePrisma();
    const marker = `[integration-test] rest-homework-${crypto.randomUUID()}`;
    try {
      const owner = await createActor();
      const other = await createActor();
      const source = await db.section.findUniqueOrThrow({
        where: { jwId: DEV_SEED.section.jwId },
        select: { courseId: true, semesterId: true },
      });
      const section = await db.section.create({
        data: {
          ...source,
          code: marker,
          jwId: 1_800_000_000 + Math.floor(Math.random() * 100_000_000),
        },
      });
      const homework = await db.homework.create({
        data: {
          sectionId: section.id,
          title: "known homework",
          createdById: owner.id,
          publishedAt: new Date("2026-09-01T00:00:00Z"),
          submissionStartAt: new Date("2026-09-01T00:00:00Z"),
          submissionDueAt: new Date("2100-01-01T00:00:00Z"),
          description: { create: { content: "known description" } },
        },
      });
      await use({ db, owner, other, section, homework });
    } finally {
      try {
        await db.section.deleteMany({ where: { code: marker } });
      } finally {
        await db.$disconnect();
      }
    }
  },
});
export const base = "/api/community/section-homeworks";
