import { describe, expect, it } from "vitest";
import {
  insertScheduleTeachers,
  replaceSectionTeachers,
  upsertCourses,
  upsertSections,
} from "../../tools/load/static-course-persistence";

type RawCall = { sql: string; params: unknown[] };

function createFakeDb() {
  const rawCalls: RawCall[] = [];
  const db = {
    async $executeRawUnsafe(sql: string, ...params: unknown[]) {
      rawCalls.push({ sql, params });
    },
  } as unknown as Parameters<typeof upsertCourses>[0];

  return { db, rawCalls };
}

function onlyJsonParam(call: RawCall) {
  expect(call.params).toHaveLength(1);
  expect(typeof call.params[0]).toBe("string");
  return JSON.parse(call.params[0] as string);
}

describe("static course persistence", () => {
  it("binds course upserts as a JSON parameter and skips empty batches", async () => {
    const { db, rawCalls } = createFakeDb();

    await upsertCourses(db, []);
    expect(rawCalls).toHaveLength(0);

    await upsertCourses(db, [
      {
        jwId: 1,
        code: "MATH1001",
        nameCn: "数学分析",
        typeId: 2,
        gradationId: 3,
        categoryId: 4,
        educationLevelId: 5,
        classTypeId: 6,
        classifyId: null,
      },
    ]);

    expect(rawCalls).toHaveLength(1);
    expect(rawCalls[0].sql).toContain('INSERT INTO "Course"');
    expect(rawCalls[0].sql).toContain("jsonb_to_recordset($1::jsonb)");
    expect(rawCalls[0].sql).toContain('ON CONFLICT ("jwId")');
    expect(onlyJsonParam(rawCalls[0])).toEqual([
      {
        jwId: 1,
        code: "MATH1001",
        nameCn: "数学分析",
        typeId: 2,
        gradationId: 3,
        categoryId: 4,
        educationLevelId: 5,
        classTypeId: 6,
        classifyId: null,
      },
    ]);
  });

  it("preserves nullable section fields in the bound JSON payload", async () => {
    const { db, rawCalls } = createFakeDb();

    await upsertSections(db, [
      {
        jwId: 11,
        code: "001",
        credits: null,
        period: null,
        dateTimePlaceText: null,
        dateTimePlacePersonText: null,
        actualPeriods: null,
        scheduleState: null,
        remark: null,
        courseId: 21,
        semesterId: 31,
        openDepartmentId: null,
      },
    ]);

    expect(rawCalls).toHaveLength(1);
    expect(rawCalls[0].sql).toContain('INSERT INTO "Section"');
    const [payload] = onlyJsonParam(rawCalls[0]);
    expect(payload).toMatchObject({
      jwId: 11,
      dateTimePlacePersonText: null,
      openDepartmentId: null,
    });
  });

  it("replaces section teachers and retires stale teacher targets", async () => {
    const { db, rawCalls } = createFakeDb();

    await replaceSectionTeachers(
      db,
      [101],
      [
        { sectionId: 101, teacherId: 201 },
        { sectionId: 101, teacherId: 202 },
      ],
    );

    expect(rawCalls.map((call) => call.sql)).toEqual([
      expect.stringContaining('DELETE FROM "_SectionTeachers"'),
      expect.stringContaining('INSERT INTO "_SectionTeachers"'),
      expect.stringContaining('UPDATE "SectionTeacher"'),
      expect.stringContaining('INSERT INTO "SectionTeacher"'),
    ]);
    expect(onlyJsonParam(rawCalls[0])).toEqual([{ id: 101 }]);
    expect(onlyJsonParam(rawCalls[1])).toEqual([
      { sectionId: 101, teacherId: 201 },
      { sectionId: 101, teacherId: 202 },
    ]);
    expect(JSON.parse(rawCalls[2].params[0] as string)).toEqual([{ id: 101 }]);
    expect(JSON.parse(rawCalls[2].params[1] as string)).toEqual([
      { sectionId: 101, teacherId: 201 },
      { sectionId: 101, teacherId: 202 },
    ]);
    expect(onlyJsonParam(rawCalls[3])).toEqual([
      { sectionId: 101, teacherId: 201 },
      { sectionId: 101, teacherId: 202 },
    ]);
  });

  it("still retires stale teacher targets when a section has no current teachers", async () => {
    const { db, rawCalls } = createFakeDb();

    await replaceSectionTeachers(db, [101], []);

    expect(rawCalls.map((call) => call.sql)).toEqual([
      expect.stringContaining('DELETE FROM "_SectionTeachers"'),
      expect.stringContaining('UPDATE "SectionTeacher"'),
    ]);
    expect(JSON.parse(rawCalls[1].params[0] as string)).toEqual([{ id: 101 }]);
    expect(JSON.parse(rawCalls[1].params[1] as string)).toEqual([]);
  });

  it("inserts schedule teacher links through a JSON parameter", async () => {
    const { db, rawCalls } = createFakeDb();

    await insertScheduleTeachers(db, [
      { scheduleId: 301, teacherId: 201 },
      { scheduleId: 301, teacherId: 202 },
    ]);

    expect(rawCalls).toHaveLength(1);
    expect(rawCalls[0].sql).toContain('INSERT INTO "_ScheduleTeachers"');
    expect(onlyJsonParam(rawCalls[0])).toEqual([
      { scheduleId: 301, teacherId: 201 },
      { scheduleId: 301, teacherId: 202 },
    ]);
  });
});
