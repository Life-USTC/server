import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "../../../src/generated/prisma-node/client";
import {
  loadRelatedCatalog,
  replaceRelatedCatalog,
} from "../../../src/static-loader/catalog-related";
import type { SnapshotRow } from "../../../src/static-loader/snapshot-values";

const RULES = "catalog_teach_course_substitute_pool_list";
const SOURCES = "catalog_teach_course_group_endpoints";
const ENTRIES = "catalog_teach_course_group_entries";
const GROUPS = "catalog_teach_course_groups";
const MEMBERS = "catalog_teach_course_group_members";
const TREE = "catalog_teach_program_tree";
const PLANS = "catalog_teach_program_info";
const MODULES = "catalog_teach_course_module_info";
const PLAN_COURSES = "catalog_teach_program_courses";

function sample() {
  const source = { source_kind: "public", source_id: "66" };
  const rawMember = { number: "0001", name: "公开课", detail: { extra: 3 } };
  const summary = { id: 13, grade: "2026", trainType: "本科" };
  const tree = { 1: { id: 1, majors: { 2: { id: 2, programs: [summary] } } } };
  const ref = (id: number, publicId: number) => ({
    self: { id, public: publicId },
  });
  return {
    [RULES]: [
      {
        id: 442,
        payload_json: JSON.stringify({
          id: 442,
          originalCourses: [{ code: "0001", credits: 4 }, { code: "0002" }],
          substituteCourses: [{ code: "0003" }],
          sourceNote: "single rule",
        }),
      },
    ],
    [SOURCES]: [
      {
        ...source,
        payload_json: JSON.stringify({
          体育选项: { 游泳: [rawMember], 其他: [] },
        }),
      },
    ],
    [ENTRIES]: [
      {
        ...source,
        route_key: "pe",
        route_position: 4,
        source_position: 0,
        name_cn: "体育类",
        name_en: "Physical Education",
      },
    ],
    [GROUPS]: [
      {
        ...source,
        group_path_json: '["体育选项"]',
        parent_group_path_json: "[]",
        group_key: "体育选项",
        group_kind: "object",
        group_position: 0,
        member_count: 0,
        display_label_cn: "体育选项",
      },
      {
        ...source,
        group_path_json: '["体育选项","游泳"]',
        parent_group_path_json: '["体育选项"]',
        group_key: "游泳",
        group_kind: "array",
        group_position: 0,
        member_count: 1,
        display_label_cn: "体育选项 - 游泳",
      },
      {
        ...source,
        group_path_json: '["体育选项","其他"]',
        parent_group_path_json: '["体育选项"]',
        group_key: "其他",
        group_kind: "array",
        group_position: 1,
        member_count: 0,
        display_label_cn: "体育选项 - 其他",
      },
    ],
    [MEMBERS]: [
      {
        ...source,
        group_path_json: '["体育选项","游泳"]',
        member_position: 0,
        course_code: "0001",
        payload_json: JSON.stringify(rawMember),
      },
    ],
    [TREE]: [{ id: 1, payload_json: JSON.stringify(tree) }],
    [PLANS]: [
      {
        program_id: 13,
        department_id: 1,
        major_id: 2,
        grade: "2026",
        train_type: "本科",
        summary_json: JSON.stringify({
          department: { id: 1 },
          major: { id: 2 },
          program: summary,
        }),
        payload_json: JSON.stringify({
          title: "培养方案",
          moduleTree: [
            ref(101, 202),
            { self: { id: 104, courses: [{ code: "0004" }] } },
          ],
        }),
      },
    ],
    [MODULES]: [
      {
        module_id: 202,
        payload_json: JSON.stringify({
          self: { id: 202 },
          children: [ref(103, 303)],
        }),
      },
      {
        module_id: 303,
        payload_json: JSON.stringify({
          self: { id: 303 },
          children: [ref(105, 202)],
        }),
      },
    ],
    [PLAN_COURSES]: [{ program_id: 13, course_code: "0004" }],
  };
}

function snapshot(tables: Record<string, SnapshotRow[]>) {
  return {
    hasTable(table: string) {
      return table in tables;
    },
    rowCount(table: string) {
      return tables[table].length;
    },
    *iterateAll(table: string) {
      yield* tables[table];
    },
    metadata: Object.fromEntries(
      Object.entries(tables).map(([key, rows]) => [
        `${key}_count`,
        String(rows.length),
      ]),
    ),
  };
}

describe("official related catalog datasets", () => {
  it("preserves directional rules, raw group hierarchy and embedded and public study plan modules", () => {
    const fixture = snapshot(sample());
    const result = loadRelatedCatalog(fixture, fixture.metadata);

    expect(result.substitutions).toEqual([
      expect.objectContaining({
        jwId: 442,
        originalCodes: ["0001", "0002"],
        substituteCodes: ["0003"],
        payload: expect.objectContaining({ sourceNote: "single rule" }),
      }),
    ]);
    expect(result.groups?.paths).toContainEqual(
      expect.objectContaining({
        path: '["体育选项","游泳"]',
        parentPath: '["体育选项"]',
        memberCount: 1,
        displayLabelCn: "体育选项 - 游泳",
      }),
    );
    expect(result.groups?.members).toEqual([
      expect.objectContaining({ courseCode: "0001", position: 0 }),
    ]);
    expect(result.groups?.sources[0].payload).toEqual({
      体育选项: {
        游泳: [{ number: "0001", name: "公开课", detail: { extra: 3 } }],
        其他: [],
      },
    });
    expect(result.studyPlans?.plans).toEqual([
      expect.objectContaining({
        jwId: 13,
        publicModuleJwIds: [202],
        payload: expect.objectContaining({
          moduleTree: expect.arrayContaining([
            { self: { id: 104, courses: [{ code: "0004" }] } },
          ]),
        }),
      }),
    ]);
    expect(
      result.studyPlans?.modules.map(({ jwId, publicModuleJwIds }) => [
        jwId,
        publicModuleJwIds,
      ]),
    ).toEqual([
      [202, [303]],
      [303, [202]],
    ]);
  });

  it("skips missing or incomplete dataset contracts without affecting complete siblings", () => {
    const data = sample();
    const fixture = snapshot({
      [RULES]: data[RULES],
      [SOURCES]: data[SOURCES],
    });
    const result = loadRelatedCatalog(fixture, fixture.metadata);

    expect(result.substitutions).toHaveLength(1);
    expect(result.groups).toBeUndefined();
    expect(result.studyPlans).toBeUndefined();
    expect(loadRelatedCatalog(fixture, {}).substitutions).toBeUndefined();
  });

  it("fails a declared count mismatch or broken join before database replacement", () => {
    const fixture = snapshot(sample());
    const invalidGroupRows = snapshot({ ...sample(), [MEMBERS]: [] });
    const missingModuleRows = snapshot({ ...sample(), [MODULES]: [] });

    expect(() =>
      loadRelatedCatalog(fixture, {
        ...fixture.metadata,
        [`${RULES}_count`]: "2",
      }),
    ).toThrow("count does not match snapshot metadata");
    expect(() =>
      loadRelatedCatalog(invalidGroupRows, invalidGroupRows.metadata),
    ).toThrow("all raw group memberships indexed");
    expect(() =>
      loadRelatedCatalog(missingModuleRows, missingModuleRows.metadata),
    ).toThrow("referenced public module 202 missing");
  });

  it("writes only authoritative sources and skips unchanged source content on the next import", async () => {
    const data = sample();
    const fixture = snapshot({ [RULES]: data[RULES] });
    const state = new Map<string, string>();
    const deleteMany = vi.fn();
    const createMany = vi.fn();
    const tx = {
      courseSubstitutionRule: { deleteMany, createMany },
      officialRelatedCatalogState: {
        async findUnique({ where: { source } }: { where: { source: string } }) {
          const digest = state.get(source);
          return digest ? { source, digest } : null;
        },
        async upsert({
          create: { source, digest },
        }: {
          create: { source: string; digest: string };
        }) {
          state.set(source, digest);
        },
      },
    } as unknown as Prisma.TransactionClient;
    const related = loadRelatedCatalog(fixture, fixture.metadata);

    await expect(replaceRelatedCatalog(tx, related)).resolves.toMatchObject({
      substitutions: 1,
    });
    await replaceRelatedCatalog(tx, related);
    await replaceRelatedCatalog(tx, loadRelatedCatalog(fixture, {}));

    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledExactlyOnceWith({
      data: related.substitutions,
    });
    expect(state.size).toBe(1);
  });
});
