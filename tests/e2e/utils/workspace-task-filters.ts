import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import type { TestPrismaClient } from "../../shared/prisma";
import { withBrowserWorkflow } from "./browser-workflow";
import { DEV_SEED } from "./dev-seed";
import {
  type HomeworkEffectContext,
  type HomeworkEffects,
  withHomeworkEffects,
} from "./homework-effects";
import type { IsolatedWorker } from "./isolated-worker";
import { test as workerTest } from "./owned-worker";

const DAY_MS = 24 * 60 * 60 * 1_000;

function shanghaiDateFromOffset(offsetDays: number) {
  return formatShanghaiDate(new Date(Date.now() + offsetDays * DAY_MS));
}

/** Arrange only domain rows in the calling test's private database. */
export async function createWorkspaceTaskFilterState(
  prisma: TestPrismaClient,
  userId: string,
  options: { includePending?: boolean } = {},
) {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 9);
  const marker = `e2e-filter-${suffix}`;
  const includePending = options.includePending ?? false;
  const courseName = `E2E Filter Course ${suffix}`;
  const courseCode = `E2EF${suffix}`;
  const sectionCode = `${courseCode}.01`;
  const completedHomeworkTitle = `${marker} completed homework`;
  const pendingHomeworkTitle = `${marker} pending homework`;
  const completedTodoTitle = `${marker} completed todo`;
  const pendingTodoTitle = `${marker} pending todo`;
  const completedExamRoom = `${marker}-past-room`;
  const pendingExamRoom = `${marker}-upcoming-room`;

  return prisma.$transaction(async (tx) => {
    const semester = await tx.semester.create({
      data: {
        jwId: DEV_SEED.semesterJwId,
        code: "421",
        nameCn: DEV_SEED.semesterNameCn,
        startDate: new Date("2026-04-08T00:00:00Z"),
        endDate: new Date(Date.now() + 180 * DAY_MS),
      },
    });
    // Stable identifiers are local to this test's empty private database.
    const firstJwId = 1_500_000_000;
    const course = await tx.course.create({
      data: {
        code: courseCode,
        jwId: firstJwId,
        nameCn: courseName,
        nameEn: courseName,
      },
      select: { id: true },
    });
    const section = await tx.section.create({
      data: {
        code: sectionCode,
        courseId: course.id,
        jwId: firstJwId + 1,
        semesterId: semester.id,
      },
      select: { id: true },
    });

    await tx.userSectionSubscription.create({
      data: { sectionId: section.id, userId: userId },
    });

    const homework = await tx.homework.create({
      data: {
        createdById: userId,
        publishedAt: new Date(),
        sectionId: section.id,
        submissionDueAt: new Date(Date.now() + 7 * DAY_MS),
        title: completedHomeworkTitle,
      },
      select: { id: true },
    });
    await tx.homeworkCompletion.create({
      data: { homeworkId: homework.id, userId: userId },
    });
    if (includePending) {
      await tx.homework.create({
        data: {
          createdById: userId,
          publishedAt: new Date(),
          sectionId: section.id,
          submissionDueAt: new Date(Date.now() + 7 * DAY_MS),
          title: pendingHomeworkTitle,
        },
      });
    }

    await tx.todo.create({
      data: {
        completed: true,
        content: `${marker} todo content`,
        dueAt: new Date(Date.now() + 7 * DAY_MS),
        priority: "high",
        title: completedTodoTitle,
        userId: userId,
      },
    });
    if (includePending) {
      await tx.todo.create({
        data: {
          completed: false,
          content: `${marker} pending todo content`,
          dueAt: new Date(Date.now() + 7 * DAY_MS),
          priority: "medium",
          title: pendingTodoTitle,
          userId: userId,
        },
      });
    }

    await tx.exam.create({
      data: {
        endTime: 1100,
        examDate: new Date(`${shanghaiDateFromOffset(-3)}T00:00:00Z`),
        examMode: "E2E closed book",
        examRooms: {
          create: [{ count: 1, room: completedExamRoom }],
        },
        examTakeCount: 1,
        examType: 1,
        jwId: firstJwId + 2,
        sectionId: section.id,
        startTime: 900,
      },
    });

    if (includePending) {
      await tx.exam.create({
        data: {
          endTime: 1100,
          examDate: new Date(`${shanghaiDateFromOffset(3)}T00:00:00Z`),
          examMode: "E2E open book",
          examRooms: {
            create: [{ count: 1, room: pendingExamRoom }],
          },
          examTakeCount: 1,
          examType: 1,
          jwId: firstJwId + 3,
          sectionId: section.id,
          startTime: 900,
        },
      });
    }

    return {
      courseId: course.id,
      sectionId: section.id,
      semesterId: semester.id,
      userId,
      completedTitle: {
        exams: completedExamRoom,
        homeworks: completedHomeworkTitle,
        todos: completedTodoTitle,
      },
      pendingTitle: {
        exams: pendingExamRoom,
        homeworks: pendingHomeworkTitle,
        todos: pendingTodoTitle,
      },
    };
  });
}

export type WorkspaceTaskFilterState = Awaited<
  ReturnType<typeof createWorkspaceTaskFilterState>
>;
export type TaskFilterDb = <T>(
  work: (db: TestPrismaClient) => Promise<T>,
) => Promise<T>;
export type TaskFilterEffects = HomeworkEffects & { sectionId?: number };

export const test = workerTest.extend<{
  taskFilterActor: Awaited<ReturnType<IsolatedWorker["createActor"]>>;
  taskFilterDb: TaskFilterDb;
  taskFilterState: (
    includePending: boolean,
  ) => Promise<WorkspaceTaskFilterState>;
  taskFilterRun: (
    work: (context: HomeworkEffectContext) => Promise<void>,
    effects: TaskFilterEffects,
  ) => Promise<void>;
}>({
  taskFilterActor: async ({ isolatedWorker, run }, use) => {
    await use(await run(() => isolatedWorker.createActor()));
  },
  taskFilterDb: async ({ isolatedWorker, run }, use) => {
    await use((work) => run(() => work(isolatedWorker.database.owner)));
  },
  taskFilterState: async ({ taskFilterActor, taskFilterDb }, use) => {
    await use((includePending) =>
      taskFilterDb((db) =>
        createWorkspaceTaskFilterState(db, taskFilterActor.id, {
          includePending,
        }),
      ),
    );
  },
  taskFilterRun: async (
    { isolatedWorker, page, taskFilterActor, run },
    use,
    testInfo,
  ) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work, effects) =>
        workflow.run(() =>
          run(() =>
            withHomeworkEffects(
              {
                page,
                isolatedWorker,
                account: taskFilterActor,
                testInfo,
                ...effects,
                observeReads: true,
              },
              async (context) => {
                await page.context().addCookies([taskFilterActor.cookie]);
                await workflow.body(() => work(context));
              },
            ),
          ),
        ),
      );
    });
  },
});
