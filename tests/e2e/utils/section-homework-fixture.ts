import type {
  Homework,
  Section,
  User,
} from "../../../src/generated/prisma-node/client";
import {
  type AcademicState,
  createHomeworkAcademic,
  createHomeworkRows,
} from "./homework-fixture";
import { test as workerTest } from "./isolated-worker";
import { withSettledPageWrites } from "./settled-page-writes";

// The private Worker owns asynchronous tasks, queues, database, and KV/R2.
// Its teardown stops workerd before dropping this case's entire state.
export const test = workerTest.extend<{
  account: User;
  academic: AcademicState;
  homeworks: Homework[];
  section: Section & { path: string };
}>({
  account: async ({ isolatedWorker, page }, use) => {
    const actor = await isolatedWorker.createActor();
    await page.context().addCookies([actor.cookie]);
    await use(
      await isolatedWorker.database.owner.user.findUniqueOrThrow({
        where: { id: actor.id },
      }),
    );
  },
  academic: async ({ isolatedWorker, account }, use) => {
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
    await use(await createHomeworkAcademic(db, account.id, semester.id));
  },
  homeworks: async ({ isolatedWorker, academic, account }, use) => {
    await use(
      await createHomeworkRows(
        isolatedWorker.database.owner,
        account.id,
        academic,
      ),
    );
  },
  section: async ({ academic, page }, use) => {
    await withSettledPageWrites(
      page,
      (url) =>
        url.pathname === "/api/community/section-homeworks" ||
        url.pathname.startsWith("/api/community/section-homeworks/") ||
        /^\/api\/workspace\/homeworks\/[^/]+\/completion$/.test(url.pathname),
      () =>
        use({
          ...academic.section,
          path: `/catalog/sections/${academic.section.jwId}`,
        }),
    );
  },
});
