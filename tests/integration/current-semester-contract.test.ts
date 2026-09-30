import { getCurrentSemester } from "@/features/catalog/server/academic-metadata-read-model";
import { nodeProtocolTest as it } from "../shared/node-protocol-fixture";

it("semester.current-semester.latest-startdate-wins", async ({
  isolatedDatabase: { owner: db },
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const { older, newer } = await db.$transaction(async (tx) => {
      const older = await tx.semester.create({
        data: {
          jwId: 1,
          code: "older",
          nameCn: "Old overlapping semester",
          startDate: new Date("2045-02-01"),
          endDate: new Date("2045-09-01"),
        },
      });
      const newer = await tx.semester.create({
        data: {
          jwId: 2,
          code: "newer",
          nameCn: "New overlapping semester",
          startDate: new Date("2045-04-01"),
          endDate: new Date("2045-08-01"),
        },
      });
      return { older, newer };
    });
    expect(
      (
        await protocolRuntime.request(() =>
          getCurrentSemester(new Date("2045-03-31T15:59:59.999Z")),
        )
      )?.id,
    ).toBe(older.id);
    expect(
      (
        await protocolRuntime.request(() =>
          getCurrentSemester(new Date("2045-03-31T16:00:00.000Z")),
        )
      )?.id,
    ).toBe(newer.id);
    expect(
      (
        await protocolRuntime.request(() =>
          getCurrentSemester(new Date("2045-06-01T00:00:00.000Z")),
        )
      )?.id,
    ).toBe(newer.id);
  });
});

it("semester.current-semester-by-rules", async ({
  isolatedDatabase: { owner: db },
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const semester = await db.$transaction((tx) =>
      tx.semester.create({
        data: {
          jwId: 1,
          code: "shanghai-day",
          nameCn: "Shanghai day semester",
          startDate: new Date("2046-04-01"),
          endDate: new Date("2046-04-02"),
        },
      }),
    );
    for (const date of [
      "2046-03-31T16:00:00.000Z",
      "2046-04-02T15:59:59.999Z",
    ]) {
      expect(
        (
          await protocolRuntime.request(() =>
            getCurrentSemester(new Date(date)),
          )
        )?.id,
      ).toBe(semester.id);
    }
    for (const date of [
      "2046-03-31T15:59:59.999Z",
      "2046-04-02T16:00:00.000Z",
    ]) {
      expect(
        await protocolRuntime.request(() => getCurrentSemester(new Date(date))),
      ).toBeNull();
    }
  });
});
