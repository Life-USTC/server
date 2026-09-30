import { expect } from "@playwright/test";
import type { TestPrismaClient } from "../../../../shared/prisma";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { busTest } from "../../../utils/personal-preferences-fixture";

export const test = busTest.extend<{
  busOwner: Awaited<ReturnType<IsolatedWorker["createActor"]>>;
}>({
  busOwner: async ({ isolatedWorker, preferenceFlow }, use) => {
    await use(
      await preferenceFlow.prepare(async () => {
        const actor = await isolatedWorker.createActor();
        const now = new Date();
        await isolatedWorker.database.owner.$transaction(async (db) => {
          await db.user.update({
            where: { id: actor.id },
            data: { emailVerified: true },
          });
          // Authentication refresh is covered separately from planner preferences.
          await db.session.updateMany({
            where: { userId: actor.id },
            data: {
              expires: new Date(now.getTime() + 30 * 86_400_000),
              updatedAt: now,
            },
          });
        });
        return actor;
      }),
    );
  },
});

export function busContractState(db: TestPrismaClient) {
  return db.$transaction(async (tx) => ({
    users: await tx.user.findMany({ orderBy: { id: "asc" } }),
    sessions: await tx.session.findMany({ orderBy: { id: "asc" } }),
    campuses: await tx.busCampus.findMany({ orderBy: { id: "asc" } }),
    routes: await tx.busRoute.findMany({ orderBy: { id: "asc" } }),
    stops: await tx.busRouteStop.findMany({ orderBy: { id: "asc" } }),
    versions: await tx.busScheduleVersion.findMany({ orderBy: { id: "asc" } }),
    trips: await tx.busTrip.findMany({ orderBy: { id: "asc" } }),
  }));
}

export function expectBusContractGraph(
  state: Awaited<ReturnType<typeof busContractState>>,
  userId: string,
) {
  expect(state.users).toHaveLength(1);
  expect(state.users[0]).toMatchObject({ id: userId, calendarFeedToken: null });
  expect(state.sessions).toHaveLength(1);
  expect(state.sessions[0].userId).toBe(userId);
  expect(state.campuses.map(({ id }) => id)).toEqual([1, 2, 3, 4, 5, 6]);
  expect(state.routes.map(({ id }) => id)).toEqual([1, 3, 7, 8]);
  expect(state.stops).toHaveLength(13);
  expect(state.versions).toHaveLength(1);
  expect(state.trips).toHaveLength(22);
}

export async function expectBusContractEffectsEmpty(db: TestPrismaClient) {
  for (const rows of await Promise.all([
    db.auditLog.findMany(),
    db.course.findMany(),
    db.semester.findMany(),
    db.section.findMany(),
    db.teacher.findMany(),
    db.comment.findMany(),
    db.description.findMany(),
    db.homework.findMany(),
    db.todo.findMany(),
    db.userSectionSubscription.findMany(),
    db.upload.findMany(),
    db.uploadPending.findMany(),
    db.oAuthClient.findMany(),
    db.oAuthConsent.findMany(),
    db.oAuthGrantUsageDaily.findMany(),
    db.oAuthAccessToken.findMany(),
    db.oAuthRefreshToken.findMany(),
    db.deviceCode.findMany(),
  ]))
    expect(rows).toEqual([]);
}
