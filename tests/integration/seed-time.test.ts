import { readFileSync } from "node:fs";
import { describe } from "vitest";
import { parsePersonalCalendarRange } from "@/features/calendar/server/personal-calendar-range";
import { getSemesterWeeks } from "@/features/workspace/server/workspace-calendar-helpers";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { DEV_SEED, DEV_SEED_ANCHOR } from "../fixtures/dev-seed";
import { nodeProtocolTest as it } from "../shared/node-protocol-fixture";

function readSemesterSeedInserts() {
  const seedSql = readFileSync(
    new URL("../../prisma/seed.sql", import.meta.url),
    "utf8",
  );
  const semesterBlock = seedSql.slice(
    seedSql.indexOf("-- Data for Name: Semester;"),
    seedSql.indexOf("-- Data for Name: TeachLanguage;"),
  );
  return semesterBlock
    .split("\n")
    .filter((line) => line.startsWith('INSERT INTO public."Semester"'));
}

describe("named seed semester dates", () => {
  it("preserves the bounded sample semester and calendar range when reseeded", {
    tags: ["@Infrastructure/Runtime"],
  }, async ({
    isolatedDatabase: { owner: prisma },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const inserts = readSemesterSeedInserts();
      // Reapplying the development sample must preserve its named dates.
      await prisma.$transaction(async (tx) => {
        for (let pass = 0; pass < 2; pass++)
          for (const insert of inserts) await tx.$executeRawUnsafe(insert);
      });
      const [current, previous] = await Promise.all([
        prisma.semester.findUniqueOrThrow({
          where: { jwId: DEV_SEED.semesterJwId },
          select: { startDate: true, endDate: true },
        }),
        prisma.semester.findUniqueOrThrow({
          where: { jwId: DEV_SEED.previousSemesterJwId },
          select: { startDate: true, endDate: true },
        }),
      ]);

      expect(current).toEqual({
        startDate: new Date("2026-04-08T00:00:00Z"),
        endDate: new Date("2026-09-06T00:00:00Z"),
      });
      expect(previous).toEqual({
        startDate: new Date("2025-10-21T00:00:00Z"),
        endDate: new Date("2026-03-30T00:00:00Z"),
      });
      const weeks = getSemesterWeeks(
        shanghaiDayjs(current.startDate),
        shanghaiDayjs(current.endDate),
      );
      const dateFrom = weeks[0][0].format("YYYY-MM-DD");
      const dateTo = weeks.at(-1)?.at(-1)?.format("YYYY-MM-DD");
      expect({ dateFrom, dateTo }).toEqual({
        dateFrom: "2026-04-06",
        dateTo: "2026-09-06",
      });
      expect(dateFrom <= DEV_SEED_ANCHOR.date).toBe(true);
      expect(dateTo && DEV_SEED_ANCHOR.date <= dateTo).toBe(true);
      expect(() =>
        parsePersonalCalendarRange({ dateFrom, dateTo }),
      ).not.toThrow();
    });
  });
});
