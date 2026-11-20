import {
  array,
  countedTables,
  integer,
  json,
  jsonDocument,
  object,
  type RelatedMetadata,
  type RelatedSnapshot,
  requireCatalogValue,
  text,
  unique,
} from "./catalog-related-values";

const TREE = "catalog_teach_program_tree";
const PLANS = "catalog_teach_program_info";
const MODULES = "catalog_teach_course_module_info";
const PROJECTED_COURSES = "catalog_teach_program_courses";

function publicReferences(roots: unknown[]) {
  const pending = [...roots];
  const refs = new Set<number>();
  while (pending.length > 0) {
    const node = object(pending.pop(), "public module node");
    const self = object(node.self, "module.self");
    const ownId = integer(self.id, "module.self.id");
    if (self.public != null) {
      const publicId = integer(self.public, "module.self.public");
      if (publicId !== ownId) refs.add(publicId);
    }
    if (node.children != null) {
      pending.push(...array(node.children, "module.children"));
    }
  }
  return [...refs].sort((first, second) => first - second);
}

function indexPlans(tree: Record<string, unknown>) {
  const result = new Map<
    number,
    {
      departmentJwId: number;
      majorJwId: number;
      grade: string;
      trainType: string | null;
    }
  >();
  for (const value of Object.values(tree)) {
    const department = object(value, "program tree department");
    const departmentJwId = integer(department.id, "department.id");
    for (const value of Object.values(
      object(department.majors, "department.majors"),
    )) {
      const major = object(value, "program tree major");
      const majorJwId = integer(major.id, "major.id");
      for (const value of array(major.programs, "major.programs")) {
        const summary = object(value, "program tree summary");
        const id = integer(summary.id, "program summary ID");
        const grade = text(summary.grade, "program grade");
        const trainType =
          summary.trainType == null
            ? null
            : text(summary.trainType, "program train type");
        const previous = result.get(id);
        requireCatalogValue(
          previous == null ||
            (previous.departmentJwId === departmentJwId &&
              previous.majorJwId === majorJwId &&
              previous.grade === grade &&
              previous.trainType === trainType),
          `conflicting study plan tree entries ${id}`,
        );
        result.set(id, { departmentJwId, majorJwId, grade, trainType });
      }
    }
  }
  return result;
}

export function loadOfficialStudyPlans(
  snapshot: RelatedSnapshot,
  metadata: RelatedMetadata,
) {
  if (
    !countedTables(
      snapshot,
      metadata,
      [PLANS, MODULES, PROJECTED_COURSES],
      [TREE],
    )
  )
    return;
  const rows = [...snapshot.iterateAll(TREE)];
  requireCatalogValue(
    rows.length === 1 && rows[0].id === 1,
    "unique study plan tree",
  );
  const tree = object(json(rows[0].payload_json, TREE), TREE);
  const index = indexPlans(tree);
  const plans = unique(
    snapshot.iterateAll(PLANS),
    (row) => {
      const jwId = integer(row.program_id, "study plan ID");
      const entry = index.get(jwId);
      requireCatalogValue(
        entry != null &&
          row.department_id === entry.departmentJwId &&
          row.major_id === entry.majorJwId &&
          row.grade === entry.grade &&
          row.train_type === entry.trainType,
        `study plan ${jwId} matches tree`,
      );
      const info = object(json(row.payload_json, PLANS), "study plan document");
      const summary = object(
        json(row.summary_json, PLANS),
        "study plan summary",
      );
      requireCatalogValue(
        object(summary.department, "summary department").id ===
          entry.departmentJwId &&
          object(summary.major, "summary major").id === entry.majorJwId &&
          object(summary.program, "summary plan").id === jwId,
        `study plan ${jwId} summary identity`,
      );
      return {
        jwId,
        ...entry,
        publicModuleJwIds: publicReferences(
          array(info.moduleTree, "study plan moduleTree"),
        ),
        summary: jsonDocument(summary),
        payload: jsonDocument(info),
      };
    },
    (row) => row.jwId,
  );
  requireCatalogValue(
    plans.size > 0 && plans.size === index.size,
    "all indexed study plans have detail",
  );
  const modules = unique(
    snapshot.iterateAll(MODULES),
    (row) => {
      const jwId = integer(row.module_id, "public module ID");
      const info = object(
        json(row.payload_json, MODULES),
        "public module document",
      );
      requireCatalogValue(
        object(info.self, "public module self").id === jwId,
        `public module ${jwId} identity`,
      );
      return {
        jwId,
        publicModuleJwIds: publicReferences([info]),
        payload: jsonDocument(info),
      };
    },
    (row) => row.jwId,
  );

  const pending = new Set(
    [...plans.values()].flatMap((plan) => plan.publicModuleJwIds),
  );
  for (const id of pending) {
    const module = modules.get(id);
    requireCatalogValue(module, `referenced public module ${id} missing`);
    for (const reference of module.publicModuleJwIds) pending.add(reference);
  }
  requireCatalogValue(
    pending.size === modules.size,
    "all study plan modules are reachable",
  );
  return {
    tree: { id: 1, payload: jsonDocument(tree) },
    plans: [...plans.values()],
    modules: [...modules.values()],
  };
}
