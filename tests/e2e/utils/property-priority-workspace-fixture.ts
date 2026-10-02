import { expect } from "@playwright/test";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import { createCatalogContractFixture } from "../../shared/catalog-contract-fixture";
import type { TestPrismaClient } from "../../shared/prisma";
import { withBrowserWorkflow } from "./browser-workflow";
import { withHomeworkEffects } from "./homework-effects";
import { test as workerTest } from "./owned-worker";

/** Every row is owned by this fixture; shared seed data is never changed. */
async function createWorkspacePriorityFixture(owner: TestPrismaClient) {
  return owner.$transaction(async (db) => {
    const catalog = await createCatalogContractFixture({
      $transaction: (work) => work(db),
    });
    const today = formatShanghaiDate(new Date());
    const tomorrow = formatShanghaiDate(new Date(Date.now() + 86400000));
    const named = (label: string) => ({
      nameCn: `${label}中文${catalog.marker}`,
      nameEn: `${label} English ${catalog.marker}`,
    });
    const semester = await db.semester.update({
      where: { id: catalog.semester.id },
      data: {
        nameCn: "2026年秋季学期",
        startDate: new Date(`${today}T00:00:00Z`),
        endDate: new Date(Date.now() + 60 * 86400000),
      },
    });
    const presetCalendarToken = crypto.randomUUID().replaceAll("-", "");
    const user = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        name: catalog.marker,
        calendarFeedToken: presetCalendarToken,
        username: catalog.marker,
        email: `${catalog.marker}@test.invalid`,
        emailVerified: true,
      },
    });
    const campus = await db.campus.create({
      data: { ...named("Campus"), code: catalog.marker, jwId: catalog.base },
    });
    const building = await db.building.create({
      data: {
        ...named("Building"),
        code: catalog.marker,
        jwId: catalog.base,
        campusId: campus.id,
      },
    });
    const room = await db.room.create({
      data: {
        ...named("Room"),
        code: catalog.marker,
        jwId: catalog.base,
        buildingId: building.id,
        virtual: false,
        seats: 30,
        seatsForSection: 30,
      },
    });
    const section = await db.section.update({
      where: { id: catalog.sections[0].id },
      data: { id: catalog.base + 70, campusId: campus.id, credits: 3.5 },
    });
    catalog.sections[0] = section;
    const subscription = await db.userSectionSubscription.create({
      data: { userId: user.id, sectionId: section.id, kind: "regular" },
    });
    const group = await db.scheduleGroup.create({
      data: {
        jwId: catalog.base,
        sectionId: section.id,
        no: 1,
        limitCount: 30,
        stdCount: 12,
        actualPeriods: 2,
        isDefault: true,
      },
    });
    const schedule = await db.schedule.create({
      data: {
        id: catalog.base + 80,
        sectionId: section.id,
        scheduleGroupId: group.id,
        roomId: room.id,
        date: new Date(`${today}T00:00:00Z`),
        weekday: new Date(`${today}T00:00:00Z`).getUTCDay() || 7,
        startTime: 800,
        endTime: 935,
        periods: 2,
        weekIndex: 8,
        startUnit: 1,
        endUnit: 2,
        teacherParticipations: {
          create: {
            teacherId: catalog.teachers[0].id,
            periods: 2,
            exerciseClass: false,
          },
        },
      },
    });
    const batch = await db.examBatch.create({
      data: { id: catalog.base + 81, jwId: catalog.base, ...named("Batch") },
    });
    const exam = await db.exam.create({
      data: {
        id: catalog.base + 82,
        jwId: catalog.base,
        sectionId: section.id,
        examBatchId: batch.id,
        examDate: new Date(`${tomorrow}T00:00:00Z`),
        startTime: 1400,
        endTime: 1600,
        examType: 2,
        examMode: "闭卷 Closed book",
        examTakeCount: 23,
        examRooms: {
          create: { room: `ExamRoom-${catalog.marker}`, count: 23 },
        },
      },
    });
    const homework = await db.homework.create({
      include: { description: true },
      data: {
        title: `Homework ${catalog.marker}`,
        sectionId: section.id,
        createdById: user.id,
        publishedAt: new Date(`${today}T09:10:00+08:00`),
        submissionStartAt: new Date(`${today}T10:20:00+08:00`),
        submissionDueAt: new Date(`${today}T12:30:00+08:00`),
        isMajor: true,
        requiresTeam: true,
        description: {
          create: {
            content: `Instructions ${catalog.marker}`,
            lastEditedById: user.id,
            lastEditedAt: new Date(),
          },
        },
      },
    });
    const todo = await db.todo.create({
      data: {
        userId: user.id,
        title: `Todo ${catalog.marker}`,
        content: `Todo instructions ${catalog.marker}`,
        priority: "high",
        dueAt: new Date(`${today}T11:45:00+08:00`),
      },
    });
    const activity = await db.youngEvent.create({
      data: {
        youngId: `priority-activity-${catalog.marker}`,
        name: `Activity ${catalog.marker}`,
        startAt: new Date(`${today}T17:00:00+08:00`),
        endAt: new Date(`${today}T18:00:00+08:00`),
        isActive: true,
        location: `Activity room ${catalog.marker}`,
        rawJson: {},
      },
    });
    const activitySubscription = await db.userYoungEventSubscription.create({
      data: { userId: user.id, youngId: activity.youngId, observedState: "{}" },
    });
    return {
      catalog,
      activity,
      user,
      presetCalendarToken,
      semester,
      section,
      campus,
      building,
      room,
      schedule,
      batch,
      exam,
      homework,
      todo,
      subscription,
      activitySubscription,
      today,
      tomorrow,
    };
  });
}
export type WorkspacePriorityFixture = Awaited<
  ReturnType<typeof createWorkspacePriorityFixture>
> & { origin: string };

export const test = workerTest.extend<{
  workspacePriority: WorkspacePriorityFixture;
  workspacePriorityRun: (
    consumer: "tasks" | "overview" | "events" | "calendar",
    work: Parameters<typeof withHomeworkEffects>[1],
  ) => Promise<void>;
}>({
  workspacePriority: async ({ isolatedWorker, run }, use) => {
    await use(
      await run(async () => ({
        ...(await createWorkspacePriorityFixture(
          isolatedWorker.database.owner,
        )),
        origin: isolatedWorker.origin,
      })),
    );
  },
  workspacePriorityRun: async (
    { isolatedWorker, workspacePriority: data, page, run },
    use,
  ) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((consumer, work) =>
        workflow.run(() =>
          run(async () => {
            const results = await Promise.allSettled([
              withHomeworkEffects(
                {
                  page,
                  isolatedWorker,
                  account: data.user,
                  sectionId: data.section.id,
                  runBody: workflow.body,
                  observeReads: true,
                  presetCalendarToken: data.presetCalendarToken,
                  calendarMessages:
                    consumer === "calendar"
                      ? [
                          { type: "user", userId: data.user.id },
                          { type: "user", userId: data.user.id },
                        ]
                      : [],
                },
                async (effects) => {
                  const actor = await isolatedWorker.createSession(
                    data.user.id,
                  );
                  await page.context().addCookies([actor.cookie]);
                  await work(effects);
                },
              ),
            ]);
            results.push(
              ...(await Promise.allSettled([
                (async () => {
                  const db = isolatedWorker.database.owner;
                  expect(await db.user.findMany()).toEqual([data.user]);
                  expect(await db.todo.findMany()).toEqual([data.todo]);
                  expect(
                    await db.homework.findMany({
                      include: { description: true },
                    }),
                  ).toEqual([data.homework]);
                  expect(await db.homeworkCompletion.findMany()).toEqual([]);
                  expect(await db.descriptionEdit.findMany()).toEqual([]);
                  expect(await db.comment.findMany()).toEqual([]);
                  expect(await db.userSectionSubscription.findMany()).toEqual([
                    data.subscription,
                  ]);
                  expect(
                    await db.userYoungEventSubscription.findMany(),
                  ).toEqual([data.activitySubscription]);
                  expect(await db.youngEvent.findMany()).toEqual([
                    data.activity,
                  ]);
                })(),
              ])),
            );
            const errors = results.flatMap((result) =>
              result.status === "rejected" ? [result.reason] : [],
            );
            if (errors.length)
              throw new AggregateError(
                errors,
                "Workspace priority workflow failed",
              );
          }),
        ),
      );
    });
  },
});
