import type { APIRequestContext } from "@playwright/test";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test as workerTest } from "../../../e2e/utils/owned-worker";
import type { TestPrismaClient } from "../../../shared/prisma";

type Actor = { id: string; request: APIRequestContext };
type AcademicState = {
  db: TestPrismaClient;
  owner: Actor;
  other: Actor;
  section: { id: number; jwId: number };
};
type HomeworkState = AcademicState & {
  homework: { id: string; title: string };
};
type CompletionState = AcademicState & {
  createHomeworks: (count: number) => Promise<string[]>;
};

/** This domain owns its catalog, actors, requests and complete asynchronous work. */
export const test = workerTest.extend<{
  createActor: IsolatedWorker["createActor"];
  academicState: AcademicState;
  homeworkState: HomeworkState;
  completionState: CompletionState;
}>({
  createActor: async ({ isolatedWorker, run }, use) => {
    await use((options) => run(() => isolatedWorker.createActor(options)));
  },
  academicState: async ({ isolatedWorker, createActor, run }, use) => {
    const state = await run(async () => {
      const db = isolatedWorker.database.owner;
      const owner = await createActor();
      const other = await createActor();
      const section = await db.section.create({
        data: {
          jwId: 1,
          code: "REST-HOMEWORK.01",
          course: {
            create: {
              jwId: 1,
              code: "REST-HOMEWORK",
              nameCn: "作业契约课程",
              nameEn: "Homework contract course",
            },
          },
          semester: {
            create: {
              jwId: 1,
              code: "2026-autumn",
              nameCn: "2026秋",
              startDate: new Date("2026-08-31T00:00:00Z"),
              endDate: new Date("2027-01-31T00:00:00Z"),
            },
          },
        },
      });
      return { db, owner, other, section };
    });
    await use(state);
  },
  homeworkState: async ({ academicState, run }, use) => {
    const state = await run(async () => {
      const { db, owner, section } = academicState;
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
      return { ...academicState, homework };
    });
    await use(state);
  },
  completionState: async ({ academicState, run }, use) => {
    const { db, owner, section } = academicState;
    await use({
      ...academicState,
      createHomeworks: (count) =>
        run(async () => {
          const ids = Array.from({ length: count }, () => crypto.randomUUID());
          await db.homework.createMany({
            data: ids.map((id) => ({
              id,
              sectionId: section.id,
              title: "[integration-test] rest-completions",
              createdById: owner.id,
            })),
          });
          return ids;
        }),
    });
  },
});
export const base = "/api/community/section-homeworks";
