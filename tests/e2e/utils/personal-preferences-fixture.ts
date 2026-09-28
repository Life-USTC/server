import { createHash } from "node:crypto";
import type { BusStaticPayload } from "@/features/bus/lib/bus-types";
import type { User } from "../../../src/generated/prisma-node/client";
import type { TestPrismaClient } from "../../shared/prisma";
import { DEV_SEED } from "./dev-seed";
import { test as workerTest } from "./isolated-worker";
import { withSettledPageWrites } from "./settled-page-writes";

export const test = workerTest.extend<{
  account: User;
  linkAccount: User;
  pinnedAccount: User;
  busAccount: User;
  busPreferences: User;
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
  linkAccount: async ({ account, page }, use) => {
    await withSettledPageWrites(
      page,
      (url) => url.pathname === "/api/workspace/link-pins",
      () => use(account),
    );
  },
  pinnedAccount: async ({ isolatedWorker, linkAccount }, use) => {
    await isolatedWorker.database.owner.workspaceLinkPin.createMany({
      data: DEV_SEED.catalogLinks.pinnedSlugs.map((slug) => ({
        userId: linkAccount.id,
        slug,
      })),
    });
    await use(linkAccount);
  },
  busAccount: async ({ account, page }, use) => {
    await withSettledPageWrites(
      page,
      (url) => url.pathname === "/api/workspace/bus-preferences",
      () => use(account),
    );
  },
  busPreferences: async ({ isolatedWorker, busAccount }, use) => {
    await isolatedWorker.database.owner.busUserPreference.create({
      data: {
        userId: busAccount.id,
        preferredOriginCampusId: null,
        preferredDestinationCampusId: null,
        showDepartedTrips: false,
      },
    });
    await use(busAccount);
  },
});

// These four routes are the planner's known input, independent of shared seed
// state. Links tests never request this fixture or acquire bus data.
export const busTest = test.extend<{ busTimetable: undefined }>({
  busTimetable: [
    async ({ isolatedWorker }, use) => {
      const campuses = [
        { id: 1, name: "东区", latitude: 31.83892, longitude: 117.268264 },
        { id: 2, name: "西区", latitude: 31.839258, longitude: 117.256645 },
        { id: 3, name: "北区", latitude: 31.841933, longitude: 117.268125 },
        { id: 4, name: "南区", latitude: 31.822112, longitude: 117.283853 },
        { id: 5, name: "先研院", latitude: 31.826345, longitude: 117.129257 },
        { id: 6, name: "高新", latitude: 31.820447, longitude: 117.129369 },
      ];
      const schedules = [
        {
          id: 1,
          stops: [1, 3, 2],
          weekday: [
            ["07:30", null, "07:40"],
            ["09:20", null, "09:30"],
            ["18:40", null, "18:50"],
            ["21:15", null, "21:25"],
          ],
          sunday: [
            ["07:30", null, "07:40"],
            ["17:30", null, "17:40"],
            ["21:15", null, "21:25"],
          ],
        },
        {
          id: 3,
          stops: [1, 4],
          weekday: [
            ["08:30", "08:45"],
            ["12:35", "12:50"],
            ["17:45", "18:00"],
          ],
          sunday: [
            ["11:45", "12:00"],
            ["19:00", "19:15"],
          ],
        },
        {
          id: 7,
          stops: [6, 5, 2, 1],
          weekday: [
            ["08:00", "08:05", null, "08:50"],
            ["14:30", "14:35", null, "15:25"],
            ["18:30", "18:35", null, "19:25"],
          ],
          sunday: [
            ["08:00", "08:05", null, "08:50"],
            ["21:50", "21:55", null, "22:40"],
          ],
        },
        {
          id: 8,
          stops: [1, 2, 5, 6],
          weekday: [
            ["06:50", "07:00", null, "07:40"],
            ["12:50", "13:00", null, "13:40"],
            ["21:20", "21:30", null, "22:00"],
          ],
          sunday: [
            ["07:00", "07:10", null, "07:50"],
            ["18:30", "18:40", null, "19:30"],
          ],
        },
      ];
      const routes = schedules.map((schedule) => ({
        id: schedule.id,
        campuses: schedule.stops.map((id) => {
          const campus = campuses.find((campus) => campus.id === id);
          if (!campus) throw new Error(`Missing fixture campus ${id}`);
          return campus;
        }),
      }));
      const payload: BusStaticPayload = {
        campuses,
        routes,
        weekday_routes: routes.map((route, index) => ({
          id: route.id,
          route,
          time: schedules[index].weekday,
        })),
        saturday_routes: [],
        sunday_routes: routes.map((route, index) => ({
          id: route.id,
          route,
          time: schedules[index].sunday,
        })),
      };
      await isolatedWorker.database.owner.$transaction(async (db) => {
        await db.busCampus.createMany({
          data: campuses.map(({ name, ...campus }) => ({
            ...campus,
            nameCn: name,
          })),
        });
        for (const route of routes) {
          await db.busRoute.create({
            data: {
              id: route.id,
              nameCn: route.campuses.map((campus) => campus.name).join(" -> "),
              stops: {
                create: route.campuses.map((campus, stopOrder) => ({
                  campusId: campus.id,
                  stopOrder,
                })),
              },
            },
          });
        }
        const version = await db.busScheduleVersion.create({
          data: {
            key: DEV_SEED.bus.versionKey,
            title: "Static Structured Bus Timetable",
            checksum: createHash("sha256")
              .update(JSON.stringify(payload))
              .digest("hex"),
            rawJson: payload,
            effectiveFrom: new Date("2026-04-22T00:00:00Z"),
            isEnabled: true,
          },
        });
        for (const dayType of ["weekday", "sunday"] as const) {
          await db.busTrip.createMany({
            data: schedules.flatMap((schedule) =>
              schedule[dayType].map((stopTimes, position) => ({
                versionId: version.id,
                routeId: schedule.id,
                dayType,
                position,
                stopTimes,
              })),
            ),
          });
        }
      });
      await use(undefined);
    },
    { auto: true },
  ],
});

export async function storedPins(db: TestPrismaClient, userId: string) {
  return (
    await db.workspaceLinkPin.findMany({
      where: { userId },
      orderBy: { slug: "asc" },
      select: { slug: true },
    })
  ).map(({ slug }) => slug);
}

export function storedBusPreference(db: TestPrismaClient, userId: string) {
  return db.busUserPreference.findUnique({
    where: { userId },
    select: {
      preferredOriginCampusId: true,
      preferredDestinationCampusId: true,
      showDepartedTrips: true,
    },
  });
}
