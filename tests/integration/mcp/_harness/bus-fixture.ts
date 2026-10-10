import type { TestPrismaClient } from "../../../shared/prisma";

/** Only the public timetable rows needed by direct MCP bus contracts. */
export async function createPrivateMcpBus(db: TestPrismaClient) {
  const bus = {
    versionKey: "mcp-bus",
    versionTitle: "MCP 测试时刻表",
    routeId: 1,
    originCampusId: 1,
    destinationCampusId: 2,
    originCampusName: "东校区",
    destinationCampusName: "西校区",
  };
  const campuses = [
    { id: 1, name: "东校区", latitude: 31.84, longitude: 117.26 },
    { id: 2, name: "西校区", latitude: 31.83, longitude: 117.25 },
  ];
  const route = { id: bus.routeId, campuses };
  const stopTimes = ["09:00", "09:20"];
  const schedule = { id: 1, route, time: [stopTimes] };
  await db.$transaction(async (tx) => {
    await tx.busCampus.createMany({
      data: campuses.map(({ name, ...campus }) => ({
        ...campus,
        nameCn: name,
      })),
    });
    await tx.busRoute.create({
      data: {
        id: bus.routeId,
        nameCn: "东校区 → 西校区",
        nameEn: "East Campus to West Campus",
        stops: {
          create: campuses.map(({ id }, stopOrder) => ({
            campusId: id,
            stopOrder,
          })),
        },
      },
    });
    await tx.busScheduleVersion.create({
      data: {
        key: bus.versionKey,
        title: bus.versionTitle,
        checksum: "mcp-bus-checksum",
        rawJson: {
          campuses,
          routes: [route],
          weekday_routes: [schedule],
          saturday_routes: [schedule],
          sunday_routes: [schedule],
          message: {
            message: bus.versionTitle,
            url: "https://example.test/timetable",
          },
        },
        trips: {
          create: (["weekday", "saturday", "sunday"] as const).map(
            (dayType) => ({
              routeId: bus.routeId,
              dayType,
              position: 0,
              stopTimes,
            }),
          ),
        },
      },
    });
  });
  return bus;
}
