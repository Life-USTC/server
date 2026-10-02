import type {
  Homework,
  Section,
  User,
} from "../../../src/generated/prisma-node/client";
import { withBrowserWorkflow } from "./browser-workflow";
import { type HomeworkEffects, withHomeworkEffects } from "./homework-effects";
import {
  type AcademicState,
  createHomeworkAcademic,
  createHomeworkRows,
} from "./homework-state";
import type { IsolatedWorker } from "./isolated-worker";
import { test as workerTest } from "./owned-worker";

// Keep complete preparation and browser workflows alive before their private
// Worker, page and database can close. Each scenario declares its expected
// native calendar deliveries and audits alongside the original UI assertions.
export const test = workerTest.extend<{
  actor: Awaited<ReturnType<IsolatedWorker["createActor"]>>;
  account: User;
  academic: AcademicState;
  homeworks: Homework[];
  section: Section & { path: string };
  sectionRun: (
    work: (effects: { headers: Record<string, string> }) => Promise<void>,
    effects?: HomeworkEffects,
  ) => Promise<void>;
}>({
  actor: async ({ isolatedWorker, run }, use) => {
    await use(await run(() => isolatedWorker.createActor()));
  },
  account: async ({ isolatedWorker, actor, run }, use) => {
    await use(
      await run(() =>
        isolatedWorker.database.owner.user.findUniqueOrThrow({
          where: { id: actor.id },
        }),
      ),
    );
  },
  academic: async ({ isolatedWorker, account, run }, use) => {
    await use(
      await run(async () => {
        const db = isolatedWorker.database.owner;
        const semester = await db.semester.create({
          data: {
            jwId: 1,
            code: "2026-autumn",
            nameCn: "2026年秋季学期",
            startDate: new Date("2026-08-31T00:00:00Z"),
            endDate: new Date("2027-01-31T00:00:00Z"),
          },
        });
        return createHomeworkAcademic(db, account.id, semester.id);
      }),
    );
  },
  homeworks: async ({ isolatedWorker, academic, account, run }, use) => {
    await use(
      await run(() =>
        createHomeworkRows(isolatedWorker.database.owner, account.id, academic),
      ),
    );
  },
  section: async ({ academic }, use) => {
    await use({
      ...academic.section,
      path: `/catalog/sections/${academic.section.jwId}`,
    });
  },
  sectionRun: async ({ isolatedWorker, page, actor, academic, run }, use) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work, effects = { calendarMessages: [] }) => {
        return workflow.run(() =>
          run(() =>
            withHomeworkEffects(
              {
                page,
                isolatedWorker,
                account: actor,
                sectionId: academic.section.id,
                runBody: workflow.body,
                ...effects,
              },
              async (observer) => {
                await page.context().addCookies([actor.cookie]);
                await work(observer);
              },
            ),
          ),
        );
      });
    });
  },
});
