import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { createTestPrisma } from "../shared/prisma";

const prisma = createTestPrisma();
const semesterSeed = readFileSync("prisma/seed.sql", "utf8")
  .split("\n")
  .filter((line) => line.startsWith('INSERT INTO public."Semester"'));

afterAll(() => prisma.$disconnect());

describe("seed semester coverage", () => {
  it("preserves the fixed scenario and refreshes current coverage across dates and reseeds", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE TEMP TABLE "SeedSemester" (
        id integer PRIMARY KEY, "jwId" integer UNIQUE, "nameCn" text,
        code text, "startDate" date, "endDate" date
      ) ON COMMIT DROP`);

      expect(semesterSeed).toHaveLength(2);
      for (const [now, expectedEnd] of [
        ["2026-04-29T00:00:00+08:00", "2026-09-06"],
        ["2026-09-10T12:00:00+08:00", "2027-01-18"],
        ["2035-12-31T16:00:00Z", "2036-05-10"],
      ]) {
        for (const sql of semesterSeed) {
          await tx.$executeRawUnsafe(
            sql
              .replace('public."Semester"', '"SeedSemester"')
              .replace("CURRENT_TIMESTAMP", `TIMESTAMPTZ '${now}'`),
          );
        }
        const rows = await tx.$queryRaw<
          Array<{ jwId: number; start: string; end: string }>
        >`SELECT "jwId", "startDate"::text AS start, "endDate"::text AS end
          FROM "SeedSemester" ORDER BY "jwId"`;
        expect(rows).toEqual([
          { jwId: 9900000, start: "2025-10-21", end: "2026-03-30" },
          { jwId: 9900001, start: "2026-04-08", end: expectedEnd },
        ]);
      }
    });
  });
});
