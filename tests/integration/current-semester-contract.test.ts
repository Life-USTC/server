import { afterAll, expect, it } from "vitest";
import { findCurrentSemester } from "@/features/catalog/server/academic-metadata-read-model";
import { createFixturePrisma, disconnectTestPrisma } from "../shared/prisma";

const prisma = createFixturePrisma();
afterAll(() => disconnectTestPrisma(prisma));

it("semester.current-semester.latest-startdate-wins", async () => {
  const rollback = new Error("rollback semester overlap fixture");
  try {
    await prisma.$transaction(async (tx) => {
      // Fixture and worker Prisma clients expose the same delegate with separately generated types.
      const semesterReader = tx.semester as unknown as Parameters<
        typeof findCurrentSemester
      >[0];
      const marker = 2_142_000_000 + (Date.now() % 100_000);
      const older = await tx.semester.create({
        data: {
          jwId: marker,
          code: `old-${marker}`,
          nameCn: "Old overlapping semester",
          startDate: new Date("2045-02-01"),
          endDate: new Date("2045-09-01"),
        },
      });
      const newer = await tx.semester.create({
        data: {
          jwId: marker + 1,
          code: `new-${marker}`,
          nameCn: "New overlapping semester",
          startDate: new Date("2045-04-01"),
          endDate: new Date("2045-08-01"),
        },
      });
      expect(
        (
          await findCurrentSemester(
            semesterReader,
            new Date("2045-03-31T15:59:59.999Z"),
          )
        )?.id,
      ).toBe(older.id);
      expect(
        (
          await findCurrentSemester(
            semesterReader,
            new Date("2045-03-31T16:00:00.000Z"),
          )
        )?.id,
      ).toBe(newer.id);
      expect(
        (
          await findCurrentSemester(
            semesterReader,
            new Date("2045-06-01T00:00:00.000Z"),
          )
        )?.id,
      ).toBe(newer.id);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
});

it("semester.current-semester-by-rules", async () => {
  const rollback = new Error("rollback semester day fixture");
  try {
    await prisma.$transaction(async (tx) => {
      // Fixture and worker Prisma clients expose the same delegate with separately generated types.
      const semesterReader = tx.semester as unknown as Parameters<
        typeof findCurrentSemester
      >[0];
      const marker = 2_143_000_000 + (Date.now() % 100_000);
      const semester = await tx.semester.create({
        data: {
          jwId: marker,
          code: `day-${marker}`,
          nameCn: "Shanghai day semester",
          startDate: new Date("2046-04-01"),
          endDate: new Date("2046-04-02"),
        },
      });
      for (const date of [
        "2046-03-31T16:00:00.000Z",
        "2046-04-02T15:59:59.999Z",
      ]) {
        expect(
          (await findCurrentSemester(semesterReader, new Date(date)))?.id,
        ).toBe(semester.id);
      }
      for (const date of [
        "2046-03-31T15:59:59.999Z",
        "2046-04-02T16:00:00.000Z",
      ]) {
        expect(
          await findCurrentSemester(semesterReader, new Date(date)),
        ).toBeNull();
      }
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
});
