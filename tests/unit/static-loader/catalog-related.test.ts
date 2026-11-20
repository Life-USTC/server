import { expect, it } from "vitest";
import { loadRelatedCatalog } from "../../../src/static-loader/catalog-related";
import type { SnapshotRow } from "../../../src/static-loader/snapshot-values";

function source(tables: Record<string, SnapshotRow[]>) {
  return {
    hasTable: (name: string) => name in tables,
    rowCount: (name: string) => tables[name].length,
    *iterateAll(name: string) {
      yield* tables[name];
    },
    metadata: Object.fromEntries(
      Object.entries(tables).map(([name, rows]) => [
        `${name}_count`,
        String(rows.length),
      ]),
    ),
  };
}

it("indexes source course codes while retaining rule direction, directory paths and module references", () => {
  const rule = {
    id: 8,
    originalCourses: [{ code: "001" }],
    substituteCourses: [{ code: "002" }],
  };
  const group = { source_kind: "public", source_id: "43" };
  const groups = { 数学类: [{ number: "001", extra: "source detail" }] };
  const module = { self: { id: 3 }, children: [{ self: { id: 4 } }] };
  const detail = { moduleTree: [{ self: { id: 2, public: 3 } }] };
  const snapshot = source({
    catalog_teach_course_substitute_pool_list: [
      { id: 8, payload_json: JSON.stringify(rule) },
    ],
    catalog_teach_course_group_endpoints: [
      { ...group, payload_json: JSON.stringify(groups) },
    ],
    catalog_teach_course_group_entries: [
      {
        ...group,
        route_key: "ma",
        route_position: 0,
        source_position: 0,
        name_cn: "数学",
        name_en: "Mathematics",
      },
    ],
    catalog_teach_course_groups: [
      {
        ...group,
        group_path_json: '["数学类"]',
        group_position: 0,
        display_label_cn: "数学类",
      },
    ],
    catalog_teach_course_group_members: [{ ...group, course_code: "001" }],
    catalog_teach_program_tree: [{ id: 1, payload_json: "{}" }],
    catalog_teach_program_info: [
      {
        program_id: 1,
        summary_json: '{"program":{"id":1}}',
        payload_json: JSON.stringify(detail),
      },
    ],
    catalog_teach_course_module_info: [
      { module_id: 3, payload_json: JSON.stringify(module) },
    ],
    catalog_teach_program_courses: [],
  });
  const catalog = loadRelatedCatalog(snapshot, snapshot.metadata);
  expect(catalog.rules?.[0]).toMatchObject({
    key: "8",
    courseCodes: ["001", "002"],
    payload: rule,
  });
  expect(catalog.directory?.records[0]).toMatchObject({
    key: "public/43",
    courseCodes: ["001"],
    payload: { groups, paths: [{ path: ["数学类"] }] },
  });
  expect(catalog.programs).toContainEqual(
    expect.objectContaining({
      key: "plan/1",
      payload: expect.objectContaining({ detail }),
    }),
  );
  expect(catalog.programs).toContainEqual(
    expect.objectContaining({ key: "module/3", payload: module }),
  );
  expect(loadRelatedCatalog(snapshot, {}).programs).toBeUndefined();
  expect(() =>
    loadRelatedCatalog(snapshot, {
      ...snapshot.metadata,
      catalog_teach_program_info_count: "2",
    }),
  ).toThrow(/count differs/);
});
