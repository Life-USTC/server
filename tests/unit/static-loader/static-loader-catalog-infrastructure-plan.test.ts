import { describe, expect, it } from "vitest";
import {
  loadCatalogLookups,
  loadCourses,
  loadDepartments,
  loadScheduleLookups,
  loadSemesters,
} from "@/static-loader/catalog-plan";
import { loadScheduleInfrastructure } from "@/static-loader/infrastructure-plan";
import type { Snapshot } from "@/static-loader/snapshot";
import { asInt, type SnapshotRow } from "@/static-loader/snapshot-values";

function fakeSnapshot(tables: Record<string, SnapshotRow[]>): Snapshot {
  return {
    clearCachedRows() {},
    queryAll: (table: string) => tables[table] ?? [],
    queryGrouped: (table: string, parentColumn = "parent_store_id") => {
      const grouped = new Map<number, SnapshotRow[]>();
      for (const row of tables[table] ?? []) {
        const parent = asInt(row[parentColumn]);
        if (parent == null) continue;
        const rows = grouped.get(parent) ?? [];
        rows.push(row);
        grouped.set(parent, rows);
      }
      return grouped;
    },
  } as unknown as Snapshot;
}

describe("static catalog plan", () => {
  it("loads authoritative lesson-only room types and rejects incomplete metadata", () => {
    expect(
      loadScheduleInfrastructure(
        fakeSnapshot({
          jw_room_types: [
            {
              id: 27,
              code: "LAB",
              nameZh: "实验室",
              nameEn: "Laboratory",
              semester_id: 221,
            },
          ],
        }),
      ).roomTypes,
    ).toEqual([
      { jwId: 27, code: "LAB", nameCn: "实验室", nameEn: "Laboratory" },
    ]);
    expect(() =>
      loadScheduleInfrastructure(
        fakeSnapshot({
          jw_room_types: [{ id: 27, semester_id: 221 }],
        }),
      ),
    ).toThrow("Invalid supplemental RoomType jwId 27");
  });

  it("loads valid semesters and departments while skipping malformed rows", () => {
    const snapshot = fakeSnapshot({
      catalog_teach_semester_list: [
        {
          id: "401",
          nameZh: "2025 秋",
          code: "202501",
          start: "2025-09-01",
          end: "2026-01-31",
        },
        { id: 402, code: "202601" },
      ],
      catalog_teach_department_college_tree: [
        {
          id: 1,
          code: "SCI",
          nameZh: "理学部",
          nameEn: "Science",
          isCollege: true,
          store_id: 10,
        },
        { id: 2, code: "BAD" },
      ],
      catalog_teach_department_college_tree_children: [
        {
          parent_store_id: 10,
          id: 3,
          code: "MATH",
          name: "数学系",
          nameEn: "Mathematics",
          isCollege: false,
        },
        { id: 4, code: "ORPHAN", nameZh: "孤立系" },
      ],
    });

    expect(loadSemesters(snapshot)).toEqual([
      {
        jwId: 401,
        nameCn: "2025 秋",
        code: "202501",
        start: new Date("2025-09-01"),
        end: new Date("2026-01-31"),
      },
    ]);
    expect(loadDepartments(snapshot)).toEqual([
      {
        jwId: 1,
        code: "SCI",
        nameCn: "理学部",
        nameEn: "Science",
        isCollege: true,
      },
      {
        jwId: 3,
        code: "MATH",
        nameCn: "数学系",
        nameEn: "Mathematics",
        isCollege: false,
      },
    ]);
  });

  it("deduplicates lookup names and fills missing English metadata", () => {
    const lookupTables = [
      "courseCategory",
      "courseClassify",
      "courseGradation",
      "courseType",
      "education",
      "classType",
      "examMode",
      "teachLang",
    ];
    const tables: Record<string, SnapshotRow[]> = {};
    for (const suffix of lookupTables) {
      tables[`catalog_teach_lesson_list_for_teach_${suffix}`] = [
        { cn: "通用", en: null },
        { cn: "通用", en: "Common" },
        { cn: "通用", en: "Ignored duplicate" },
        { cn: "" },
      ];
    }

    const lookups = loadCatalogLookups(fakeSnapshot(tables));

    expect(Object.values(lookups)).toHaveLength(8);
    for (const values of Object.values(lookups)) {
      expect(values).toEqual([{ nameCn: "通用", nameEn: "Common" }]);
    }
  });

  it("joins course metadata to lessons and selects the latest occurrence", () => {
    const snapshot = fakeSnapshot({
      catalog_teach_lesson_list_for_teach: [
        { store_id: "100", semester_id: "401" },
        { store_id: 101, semester_id: 421 },
        { semester_id: 421 },
        { store_id: 200, semester_id: 421 },
      ],
      catalog_teach_lesson_list_for_teach_course: [
        {
          parent_store_id: 100,
          id: 10,
          code: "MATH101",
          cn: "旧高等数学",
          en: "Old Calculus",
        },
        {
          parent_store_id: 101,
          id: 10,
          code: "MATH101",
          cn: "新高等数学",
          en: "New Calculus",
        },
        { parent_store_id: 200, id: 20, code: "BAD", cn: null },
      ],
      catalog_teach_lesson_list_for_teach_courseType: [
        { parent_store_id: 100, cn: "旧必修" },
        { parent_store_id: 101, cn: "新必修" },
      ],
      catalog_teach_lesson_list_for_teach_courseCategory: [
        { parent_store_id: 100, cn: "旧数学", en: "Old Mathematics" },
        { parent_store_id: 101, cn: "新数学", en: "New Mathematics" },
      ],
      catalog_teach_lesson_list_for_teach_courseGradation: [
        { parent_store_id: 100, cn: "旧本科" },
        { parent_store_id: 101, cn: "新本科" },
      ],
      catalog_teach_lesson_list_for_teach_courseClassify: [
        { parent_store_id: 100, cn: "旧基础课" },
        { parent_store_id: 101, cn: "新基础课" },
      ],
      catalog_teach_lesson_list_for_teach_classType: [
        { parent_store_id: 100, cn: "旧理论" },
        { parent_store_id: 101, cn: "新理论" },
      ],
      catalog_teach_lesson_list_for_teach_education: [
        { parent_store_id: 100, cn: "旧本科生" },
        { parent_store_id: 101, cn: "新本科生" },
      ],
    });

    expect(loadCourses(snapshot)).toEqual({
      courses: [
        {
          jwId: 10,
          code: "MATH101",
          nameCn: "新高等数学",
          nameEn: "New Calculus",
          typeName: "新必修",
          categoryName: "新数学",
          gradationName: "新本科",
          classifyName: "新基础课",
          classTypeName: "新理论",
          educationLevelName: "新本科生",
        },
      ],
      courseJwIdByParentId: new Map([
        [100, 10],
        [101, 10],
      ]),
    });
  });

  it("fails closed when a lesson parent maps to a malformed course", () => {
    const snapshot = fakeSnapshot({
      catalog_teach_lesson_list_for_teach: [
        { store_id: 200, semester_id: 421 },
      ],
      catalog_teach_lesson_list_for_teach_course: [
        { parent_store_id: 200, id: 20, code: "BAD" },
      ],
    });

    expect(loadCourses(snapshot)).toEqual({
      courses: [],
      courseJwIdByParentId: new Map(),
    });
  });

  it("loads unique schedule lookups and latest exam batch metadata", () => {
    const snapshot = fakeSnapshot({
      jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList_title:
        [
          { id: 3, nameZh: "教授", code: "PROF", nameEn: "Professor" },
          { id: 3, nameZh: "重复职称", code: "DUP" },
          { id: null, nameZh: "无效", code: "BAD" },
        ],
      jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList_teacherLessonType:
        [
          { id: 5, nameZh: "主讲", code: "LECTURE", role: "teacher" },
          { id: 5, nameZh: "重复类型", code: "DUP" },
          { id: null, nameZh: "无效", code: "BAD" },
        ],
      catalog_teach_exam_list_examBatch: [
        { id: 7, name: "期中", semester_id: 401 },
        { id: 7, name: "期末", semester_id: 421 },
        { id: null, name: "无效", semester_id: 421 },
      ],
    });

    expect(loadScheduleLookups(snapshot)).toEqual({
      teacherTitles: [
        {
          jwId: 3,
          nameCn: "教授",
          nameEn: "Professor",
          code: "PROF",
          enabled: undefined,
        },
      ],
      teacherLessonTypes: [
        {
          jwId: 5,
          nameCn: "主讲",
          nameEn: undefined,
          code: "LECTURE",
          role: "teacher",
          enabled: undefined,
        },
      ],
      examBatches: [{ jwId: 7, nameCn: "期末" }],
    });
  });
});

describe("static schedule infrastructure plan", () => {
  it("maps latest semester room metadata and nullable corrections with its own references", () => {
    const prefix = "jw_ws_schedule_table_datum_result_scheduleList_room";
    const tables: Record<string, SnapshotRow[]> = {
      [prefix]: [
        {
          store_id: 1,
          semester_id: 201,
          id: 501,
          nameZh: "101",
          code: "101",
          remark: "旧备注",
          nameEn: "Old",
          seats: 40,
        },
        {
          store_id: 2,
          semester_id: 421,
          id: 501,
          nameZh: "新101",
          code: "101",
          remark: null,
          nameEn: null,
          seats: 0,
        },
      ],
      [`${prefix}_building`]: [
        {
          parent_store_id: 1,
          store_id: 11,
          id: 601,
          nameZh: "旧楼",
          code: "OLD",
        },
        {
          parent_store_id: 2,
          store_id: 12,
          id: 602,
          nameZh: "新楼",
          code: "NEW",
        },
      ],
      [`${prefix}_building_campus`]: [
        { parent_store_id: 11, id: 701, nameZh: "旧校区" },
        { parent_store_id: 12, id: 702, nameZh: "新校区" },
      ],
      [`${prefix}_roomType`]: [
        { parent_store_id: 1, id: 801, nameZh: "旧类型", code: "OLD" },
        { parent_store_id: 2, id: 802, nameZh: "新类型", code: "NEW" },
      ],
    };
    const result = loadScheduleInfrastructure(fakeSnapshot(tables));
    expect(result.rooms).toEqual([
      expect.objectContaining({
        jwId: 501,
        nameCn: "新101",
        remark: undefined,
        nameEn: undefined,
        seats: 0,
        buildingJwId: 602,
        roomTypeJwId: 802,
      }),
    ]);
    expect(result.buildings).toContainEqual(
      expect.objectContaining({ jwId: 602, campusJwId: 702 }),
    );
    expect(result.campuses).toContainEqual(
      expect.objectContaining({ jwId: 702 }),
    );
    expect(result.roomTypes).toContainEqual(
      expect.objectContaining({ jwId: 802 }),
    );
    expect(
      loadScheduleInfrastructure(
        fakeSnapshot(
          Object.fromEntries(
            Object.entries(tables).map(([table, rows]) => [
              table,
              rows.toReversed(),
            ]),
          ),
        ),
      ),
    ).toEqual(result);
  });

  it("joins rooms to buildings, campuses, and room types while retaining optional metadata", () => {
    const snapshot = fakeSnapshot({
      jw_ws_schedule_table_datum_result_scheduleList_room_building: [
        {
          parent_store_id: 301,
          id: 301,
          store_id: 401,
          nameZh: "教学楼",
          nameEn: "Teaching Building",
          code: "TEACH",
        },
      ],
      jw_ws_schedule_table_datum_result_scheduleList_room_building_campus: [
        {
          parent_store_id: 401,
          id: 401,
          nameZh: "东校区",
          nameEn: "East Campus",
          code: "E",
          semester_id: 401,
        },
      ],
      jw_ws_schedule_table_datum_result_scheduleList_room_roomType: [
        {
          parent_store_id: 301,
          id: 601,
          nameZh: "普通教室",
          code: "CLASS",
        },
      ],
      jw_ws_schedule_table_datum_result_scheduleList_room: [
        { store_id: null, id: 999, nameZh: "孤立房间", code: "ORPHAN" },
        {
          store_id: 301,
          id: 501,
          nameZh: "东区 101",
          semester_id: 421,
          nameEn: "East 101",
          code: "E101",
          floor: "1",
          virtual: false,
          seatsForLesson: 45,
          seats: 50,
          remark: "可预约",
        },
        {
          store_id: 301,
          id: 501,
          nameZh: "重复房间",
          code: "DUP",
        },
        { store_id: 301, id: 502, code: "MISSING_NAME" },
      ],
      jw_ws_schedule_table_datum_result_lessonList: [],
      catalog_teach_lesson_list_for_teach_campus: [],
      catalog_teach_lesson_list_for_teach: [],
      jw_ws_schedule_table_datum_result_lessonList_adminclasses: [],
    });

    expect(loadScheduleInfrastructure(snapshot)).toEqual({
      campuses: [
        {
          jwId: 401,
          nameCn: "东校区",
          nameEn: "East Campus",
          code: "E",
        },
      ],
      roomTypes: [
        {
          jwId: 601,
          nameCn: "普通教室",
          nameEn: undefined,
          code: "CLASS",
        },
      ],
      buildings: [
        {
          jwId: 301,
          nameCn: "教学楼",
          nameEn: "Teaching Building",
          code: "TEACH",
          campusJwId: 401,
        },
      ],
      rooms: [
        {
          jwId: 501,
          nameCn: "东区 101",
          nameEn: "East 101",
          code: "E101",
          floor: 1,
          virtual: false,
          seatsForSection: 45,
          remark: "可预约",
          seats: 50,
          buildingJwId: 301,
          roomTypeJwId: 601,
        },
      ],
      adminClasses: [],
    });
  });

  it("prefers the latest catalog campus and selects valid latest admin classes", () => {
    const snapshot = fakeSnapshot({
      jw_ws_schedule_table_datum_result_scheduleList_room_building: [
        {
          parent_store_id: 301,
          id: 301,
          store_id: 401,
          nameZh: "教学楼",
          code: "B301",
        },
      ],
      jw_ws_schedule_table_datum_result_scheduleList_room_building_campus: [
        {
          parent_store_id: 401,
          id: 401,
          nameZh: "旧东校区",
          nameEn: "Old East",
          code: "E",
          semester_id: 401,
        },
      ],
      jw_ws_schedule_table_datum_result_scheduleList_room_roomType: [],
      jw_ws_schedule_table_datum_result_scheduleList_room: [
        { store_id: 301, id: 501, nameZh: "东区 101", code: "E101" },
      ],
      jw_ws_schedule_table_datum_result_lessonList: [
        { id: 9001, campusId: 401 },
        { id: 9002, campusId: 401 },
        { id: null, campusId: 402 },
      ],
      catalog_teach_lesson_list_for_teach_campus: [
        { parent_store_id: 1001, cn: "旧东校区", en: "Old East" },
        { parent_store_id: 1002, cn: "新东校区", en: "New East" },
      ],
      catalog_teach_lesson_list_for_teach: [
        { id: 9001, store_id: 1001, semester_id: 401 },
        { id: 9002, store_id: 1002, semester_id: 421 },
        { id: null, store_id: 1001, semester_id: 421 },
        { id: 9002, semester_id: 421 },
      ],
      jw_ws_schedule_table_datum_result_lessonList_adminclasses: [
        {
          id: 701,
          nameZh: "一班",
          code: "A",
          semester_id: 401,
          stdCount: "20",
          enabled: "1",
        },
        {
          id: 701,
          nameZh: "一班",
          code: "A",
          semester_id: 421,
          stdCount: "25",
          enabled: "1",
        },
        { id: null, nameZh: "无效", semester_id: 421 },
        { id: 702, nameZh: "无学期", code: "B" },
      ],
    });

    const result = loadScheduleInfrastructure(snapshot);

    expect(result.campuses).toEqual([
      { jwId: 401, nameCn: "新东校区", nameEn: "New East", code: "E" },
    ]);
    expect(result.adminClasses).toEqual([
      {
        jwId: 701,
        code: "A",
        grade: undefined,
        nameCn: "一班",
        nameEn: undefined,
        stdCount: 25,
        planCount: undefined,
        enabled: true,
        abbrZh: undefined,
        abbrEn: undefined,
      },
    ]);
  });

  it("skips incomplete building, campus, room type, and catalog joins", () => {
    const snapshot = fakeSnapshot({
      jw_ws_schedule_table_datum_result_scheduleList_room_building: [
        {
          parent_store_id: 302,
          id: 302,
          store_id: 402,
          nameZh: "缺少编码的楼",
        },
        {
          parent_store_id: 303,
          id: 303,
          store_id: 403,
          nameZh: "有问题的楼",
          code: "B303",
        },
      ],
      jw_ws_schedule_table_datum_result_scheduleList_room_building_campus: [
        { parent_store_id: 403, nameZh: "缺少 ID 的校区" },
      ],
      jw_ws_schedule_table_datum_result_scheduleList_room_roomType: [
        { parent_store_id: 302, nameZh: "缺少 ID 的类型", code: "BROKEN" },
      ],
      jw_ws_schedule_table_datum_result_scheduleList_room: [
        { store_id: 302, id: 503, nameZh: "302-01", code: "R302" },
        { store_id: 303, id: 504, nameZh: "303-01", code: "R303" },
      ],
      jw_ws_schedule_table_datum_result_lessonList: [
        { id: 9003, campusId: 403 },
      ],
      catalog_teach_lesson_list_for_teach_campus: [
        { parent_store_id: 1003, cn: null, en: "Missing Chinese name" },
      ],
      catalog_teach_lesson_list_for_teach: [
        { id: 9003, store_id: 1003, semester_id: 421 },
      ],
      jw_ws_schedule_table_datum_result_lessonList_adminclasses: [],
    });

    const result = loadScheduleInfrastructure(snapshot);

    expect(result.campuses).toEqual([]);
    expect(result.buildings).toEqual([
      {
        jwId: 303,
        nameCn: "有问题的楼",
        nameEn: undefined,
        code: "B303",
        campusJwId: undefined,
      },
    ]);
    expect(result.roomTypes).toEqual([]);
    expect(result.rooms).toHaveLength(2);
    expect(result.rooms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ jwId: 503, roomTypeJwId: undefined }),
        expect.objectContaining({ jwId: 504, buildingJwId: 303 }),
      ]),
    );
  });
});
