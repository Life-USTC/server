import { test as isolatedTest } from "../../../../utils/admin-fixture";
export const test = isolatedTest.extend<{
  initiallyActive: number;
  busState: { versions: { id: number; key: string; title: string }[] };
}>({
  initiallyActive: [0, { option: true }],
  busState: async ({ isolatedWorker, initiallyActive, run }, use) => {
    const state = await run(async () => {
      const db = isolatedWorker.database.owner;
      const campuses = [
        { id: 1, name: "Private East", latitude: 31.82, longitude: 117.28 },
        { id: 2, name: "Private West", latitude: 31.83, longitude: 117.26 },
      ];
      await db.busCampus.createMany({
        data: campuses.map(({ name, ...campus }) => ({
          ...campus,
          nameCn: name,
        })),
      });
      const route = { id: 1, campuses };
      await db.busRoute.create({
        data: {
          id: 1,
          nameCn: "Private East → Private West",
          stops: {
            create: campuses.map((campus, stopOrder) => ({
              campusId: campus.id,
              stopOrder,
            })),
          },
        },
      });
      const versions = [];
      for (const index of [0, 1]) {
        const version = await db.busScheduleVersion.create({
          data: {
            key: `private-version-${index}`,
            checksum: `private-checksum-${index}`,
            title: `Private Timetable ${index}`,
            rawJson: {
              campuses,
              routes: [route],
              weekday_routes: [
                {
                  id: 1,
                  route,
                  time: [
                    ["08:00", "08:20"],
                    ["09:00", "09:20"],
                  ],
                },
              ],
              saturday_routes: [],
              sunday_routes: [],
            },
            isEnabled: index === initiallyActive,
            effectiveFrom: new Date("2020-01-01"),
            importedAt: new Date("2026-01-01T00:00:00Z"),
          },
        });
        versions.push(version);
        await db.busTrip.createMany({
          data: [0, 1].map((position) => ({
            versionId: version.id,
            routeId: 1,
            dayType: "weekday" as const,
            position,
            stopTimes: position === 0 ? ["08:00", "08:20"] : ["09:00", "09:20"],
          })),
        });
      }
      return { versions };
    });
    await use(state);
  },
});
