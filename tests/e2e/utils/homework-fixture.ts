import type {
  Homework,
  Semester,
  User,
} from "../../../src/generated/prisma-node/client";
import type { TestPrismaClient } from "../../shared/prisma";
import { withBrowserWorkflow } from "./browser-workflow";
import { DEV_SEED } from "./dev-seed";
import { type HomeworkEffects, withHomeworkEffects } from "./homework-effects";
import {
  type AcademicState,
  createHomeworkAcademic,
  createHomeworkRows,
  readHomeworkCompletion,
  readHomeworks,
} from "./homework-state";
import type { IsolatedWorker } from "./isolated-worker";
import { test as workerTest } from "./owned-worker";

/** Every workflow owns its catalog, identity, mutations and real queue consumers. */
export const test = workerTest.extend<{
  actor: Awaited<ReturnType<IsolatedWorker["createActor"]>>;
  account: User;
  semesters: { current: Semester; previous: Semester };
  academic: AcademicState;
  homeworks: Homework[];
  homeworkStates: Homework[];
  academicDb: <T>(work: (db: TestPrismaClient) => Promise<T>) => Promise<T>;
  storedHomeworks: (
    sectionId: number,
  ) => Promise<Awaited<ReturnType<typeof readHomeworks>>>;
  storedHomeworkCompletion: (
    userId: string,
    homeworkId: string,
  ) => Promise<Awaited<ReturnType<typeof readHomeworkCompletion>>>;
  homeworkRun: (
    work: Parameters<typeof withHomeworkEffects>[1],
    effects: HomeworkEffects,
  ) => Promise<void>;
}>({
  actor: async ({ isolatedWorker, run }, use) => {
    await use(await run(() => isolatedWorker.createActor()));
  },
  account: async ({ actor, academicDb }, use) => {
    await use(
      await academicDb((db) =>
        db.user.findUniqueOrThrow({ where: { id: actor.id } }),
      ),
    );
  },
  academicDb: async ({ isolatedWorker, run }, use) => {
    await use((work) => run(() => work(isolatedWorker.database.owner)));
  },
  storedHomeworks: async ({ academicDb }, use) => {
    await use((sectionId) => academicDb((db) => readHomeworks(db, sectionId)));
  },
  storedHomeworkCompletion: async ({ academicDb }, use) => {
    await use((userId, homeworkId) =>
      academicDb((db) => readHomeworkCompletion(db, userId, homeworkId)),
    );
  },
  semesters: async ({ academicDb }, use) => {
    await use(
      await academicDb((db) =>
        db.$transaction(async (tx) => ({
          current: await tx.semester.create({
            data: {
              jwId: DEV_SEED.semesterJwId,
              code: "421",
              nameCn: DEV_SEED.semesterNameCn,
              startDate: new Date("2026-04-08T00:00:00Z"),
              endDate: new Date(Date.now() + 180 * 86_400_000),
            },
          }),
          previous: await tx.semester.create({
            data: {
              jwId: DEV_SEED.previousSemesterJwId,
              code: "420",
              nameCn: DEV_SEED.previousSemesterNameCn,
              startDate: new Date("2025-10-21T00:00:00Z"),
              endDate: new Date("2026-03-30T00:00:00Z"),
            },
          }),
        })),
      ),
    );
  },
  academic: async ({ account, semesters, academicDb }, use) => {
    await use(
      await academicDb((db) =>
        createHomeworkAcademic(db, account.id, semesters.current.id),
      ),
    );
  },
  homeworks: async ({ account, academic, academicDb }, use) => {
    await use(
      await academicDb((db) => createHomeworkRows(db, account.id, academic)),
    );
  },
  homeworkStates: async ({ account, homeworks, academicDb }, use) => {
    const overdue = await academicDb((db) =>
      db.$transaction(async (tx) => {
        const overdue = await tx.homework.update({
          where: { id: homeworks[0].id },
          data: { submissionDueAt: new Date("2020-01-01T12:00:00+08:00") },
        });
        await tx.homeworkCompletion.create({
          data: { userId: account.id, homeworkId: homeworks[1].id },
        });
        return overdue;
      }),
    );
    await use([overdue, homeworks[1]]);
  },
  homeworkRun: async ({ isolatedWorker, page, actor, academic, run }, use) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work, effects) =>
        workflow.run(() =>
          run(() =>
            withHomeworkEffects(
              {
                page,
                isolatedWorker,
                account: actor,
                sectionId: academic.section.id,
                runBody: workflow.body,
                ...effects,
                observeReads: true,
              },
              async (effects) => {
                await page.context().addCookies([actor.cookie]);
                await work(effects);
              },
            ),
          ),
        ),
      );
    });
  },
});
