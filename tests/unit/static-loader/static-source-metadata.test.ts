import { describe, expect, it } from "vitest";
import { mapExam, mapSection } from "@/static-loader/mappers";
import { loadExams, loadSections } from "@/static-loader/section-plan";
import type { Snapshot } from "@/static-loader/snapshot";
import type { SnapshotRow } from "@/static-loader/snapshot-values";

function snapshot(tables: Record<string, SnapshotRow[]>): Snapshot {
  return {
    queryAll: (table: string) => tables[table] ?? [],
    queryGrouped: (table: string) => {
      const grouped = new Map<number, SnapshotRow[]>();
      for (const row of tables[table] ?? []) {
        const parentId = Number(row.parent_store_id);
        grouped.set(parentId, [...(grouped.get(parentId) ?? []), row]);
      }
      return grouped;
    },
  } as unknown as Snapshot;
}

describe("school source metadata", () => {
  it("preserves planned weeks and catalog class names without inventing IDs", () => {
    const source = snapshot({
      catalog_teach_lesson_list_for_teach: [
        { store_id: 1, id: 101, code: "TEST.01", semester_id: 201 },
      ],
      catalog_teach_lesson_list_for_teach_course: [
        { parent_store_id: 1, id: 301 },
      ],
      catalog_teach_lesson_list_for_teach_adminClasses: [
        { parent_store_id: 1, cn: "测试班", en: "Test class" },
        { parent_store_id: 1, cn: "另一测试班", en: null },
      ],
      jw_ws_schedule_table_datum_result_lessonList: [{ store_id: 2, id: 101 }],
      jw_ws_schedule_table_datum_result_lessonList_requiredPeriodInfo: [
        { parent_store_id: 2, weeks: 18 },
      ],
    });
    const [section] = loadSections(
      source,
      201,
      new Map([[1, 301]]),
      new Map(),
      [],
    );
    expect(section.requiredWeeks).toBe(18);
    expect(section.catalogAdminClasses).toEqual([
      { nameCn: "测试班", nameEn: "Test class" },
      { nameCn: "另一测试班", nameEn: null },
    ]);
  });

  it("keeps absent planning information unknown and empty class lists empty", () => {
    expect(
      mapSection(
        { id: 101, code: "TEST.01", semester_id: 201 },
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { course: { id: 301 } },
      ),
    ).toMatchObject({ requiredWeeks: undefined, catalogAdminClasses: [] });
  });

  it("keeps exam audience text and distinct same-name monitor identities", () => {
    const source = snapshot({
      catalog_teach_exam_list: [
        {
          store_id: 1,
          id: 401,
          grades: "2021,2022",
          adminclasseNames: "测试班、另一班",
        },
      ],
      catalog_teach_exam_list_lesson: [{ parent_store_id: 1, id: 101 }],
      catalog_teach_exam_list_monitors: [
        {
          parent_store_id: 1,
          id: 501,
          cn: "同名教师",
          en: null,
          mobile: "private",
        },
        { parent_store_id: 1, id: 502, cn: "同名教师", en: "Test teacher" },
      ],
    });
    const [exam] = loadExams(source, new Set([101]));
    expect(exam.grades).toBe("2021,2022");
    expect(exam.adminClassNames).toBe("测试班、另一班");
    expect(exam.monitors).toEqual([
      { jwId: 501, nameCn: "同名教师", nameEn: null },
      { jwId: 502, nameCn: "同名教师", nameEn: "Test teacher" },
    ]);
  });

  it("preserves monitor identity when the source has no name", () => {
    expect(
      mapExam(
        { id: 2652 },
        { id: 101 },
        undefined,
        [],
        [{ id: 8535, cn: null, en: null }],
      )?.monitors,
    ).toEqual([{ jwId: 8535, nameCn: null, nameEn: null }]);
  });

  it("rejects monitor records without school identity instead of matching a name", () => {
    expect(() =>
      mapExam({ id: 401 }, { id: 101 }, undefined, [], [{ cn: "同名教师" }]),
    ).toThrow("no upstream identity");
  });
});
