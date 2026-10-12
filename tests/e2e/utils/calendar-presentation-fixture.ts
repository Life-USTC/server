import type { TestPrismaClient } from "../../shared/prisma";
import { withBrowserWorkflow } from "./browser-workflow";
import { createCalendarContractFixture } from "./calendar-contract";
import { DEV_SEED } from "./dev-seed";
import { withHomeworkEffects } from "./homework-effects";
import type { IsolatedWorker } from "./isolated-worker";
import { test as workerTest } from "./owned-worker";

export type CalendarFixture = Omit<
  Awaited<ReturnType<typeof createCalendarContractFixture>>,
  "cleanup"
> & {
  origin: string;
  createSignedSessionCookie: (
    userId: string,
  ) => Promise<Awaited<ReturnType<IsolatedWorker["createSession"]>>["cookie"]>;
};

/** Consumers prepare their own calendar, then observe the real rendered views.
 * Each scenario declares whether visiting its view creates a feed credential. */
export const test = workerTest.extend<{
  calendar: CalendarFixture;
  calendarDb: <T>(work: (db: TestPrismaClient) => Promise<T>) => Promise<T>;
  calendarRun: (
    work: Parameters<typeof withHomeworkEffects>[1],
    effects: { accountIndex: 0 | 1; calendarTokenCreated: boolean },
  ) => Promise<void>;
}>({
  calendarDb: async ({ isolatedWorker, run }, use) => {
    await use((work) => run(() => work(isolatedWorker.database.owner)));
  },
  calendar: async ({ isolatedWorker, calendarDb, run }, use) => {
    await use(
      await run(async () => {
        await calendarDb((db) =>
          db.semester.create({
            data: {
              jwId: DEV_SEED.semesterJwId,
              code: "421",
              nameCn: DEV_SEED.semesterNameCn,
              startDate: new Date("2026-04-08"),
              endDate: new Date("2026-09-06"),
            },
          }),
        );
        const { cleanup: _cleanup, ...calendar } =
          await createCalendarContractFixture(calendarDb);
        return {
          ...calendar,
          origin: isolatedWorker.origin,
          createSignedSessionCookie: (userId: string) =>
            run(
              async () => (await isolatedWorker.createSession(userId)).cookie,
            ),
        };
      }),
    );
  },
  calendarRun: async ({ isolatedWorker, calendar, page, run }, use) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work, { accountIndex, calendarTokenCreated }) => {
        return workflow.run(() =>
          run(() =>
            withHomeworkEffects(
              {
                page,
                isolatedWorker,
                account: calendar.users[accountIndex],
                sectionId: calendar.section.id,
                runBody: workflow.body,
                calendarTokenCreated,
                calendarMessages: [],
                observeReads: true,
              },
              work,
            ),
          ),
        );
      });
    });
  },
});
