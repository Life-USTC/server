import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import { DEV_SEED } from "../fixtures/dev-seed";
import { createTestPrisma, disconnectTestPrisma } from "../shared/prisma";

const prisma = createTestPrisma();

afterAll(() => disconnectTestPrisma(prisma));

function readCurrentSemesterSeedInsert() {
  const seedSql = readFileSync(
    new URL("../../prisma/seed.sql", import.meta.url),
    "utf8",
  );
  const semesterBlock = seedSql.slice(
    seedSql.indexOf("-- Data for Name: Semester;"),
    seedSql.indexOf("-- Data for Name: TeachLanguage;"),
  );
  const insert = semesterBlock
    .split("\n")
    .find(
      (line) =>
        line.startsWith('INSERT INTO public."Semester"') &&
        line.includes("9900001"),
    );
  if (!insert) {
    throw new Error("Current semester seed INSERT is missing");
  }
  return insert.replace('public."Semester"', "pg_temp.seed_semester");
}

describe("named seed semester dates", () => {
  it("keeps the current fixture active on the Shanghai calendar day", async () => {
    const [current, previous] = await Promise.all([
      prisma.semester.findUnique({
        where: { jwId: DEV_SEED.semesterJwId },
        select: { startDate: true, endDate: true },
      }),
      prisma.semester.findUnique({
        where: { jwId: DEV_SEED.previousSemesterJwId },
        select: { startDate: true, endDate: true },
      }),
    ]);

    expect(current).toBeTruthy();
    expect(previous).toBeTruthy();
    if (!current || !previous || !current.startDate || !current.endDate) {
      throw new Error("Named semester fixtures are missing date ranges");
    }

    const today = formatShanghaiDate(new Date());
    const currentEnd = current.endDate.toISOString().slice(0, 10);
    expect(current.startDate.toISOString().slice(0, 10)).toBe("2026-04-08");
    expect(currentEnd >= today).toBe(true);
    expect(previous.startDate?.toISOString().slice(0, 10)).toBe("2025-10-21");
    expect(previous.endDate?.toISOString().slice(0, 10)).toBe("2026-03-30");
  });

  it("refreshes the current fixture horizon when reseeded in a later year", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`
        CREATE TEMP TABLE seed_semester (
          id integer PRIMARY KEY,
          "jwId" integer UNIQUE NOT NULL,
          "nameCn" text NOT NULL,
          code text NOT NULL,
          "startDate" date,
          "endDate" date
        ) ON COMMIT DROP
      `);

      const seedInsert = readCurrentSemesterSeedInsert();
      const reseedAt = async (timestamp: string) => {
        await tx.$executeRawUnsafe(
          seedInsert.replace("CURRENT_TIMESTAMP", `TIMESTAMPTZ '${timestamp}'`),
        );
        return tx.$queryRawUnsafe<
          Array<{ startDate: string; endDate: string }>
        >(
          `SELECT "startDate"::text AS "startDate", "endDate"::text AS "endDate"
           FROM pg_temp.seed_semester
           WHERE "jwId" = 9900001`,
        );
      };

      await expect(reseedAt("2026-09-10 15:59:59+00")).resolves.toEqual([
        { startDate: "2026-04-08", endDate: "2027-03-09" },
      ]);
      await expect(reseedAt("2030-01-02 16:00:00+00")).resolves.toEqual([
        { startDate: "2026-04-08", endDate: "2030-07-02" },
      ]);
    });
  });
});
