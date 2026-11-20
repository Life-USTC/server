import { createHash } from "node:crypto";
import type { Prisma } from "../generated/prisma-node/client";
import { chunks } from "./database-writes";
import type { Snapshot } from "./snapshot";
import type { SnapshotRow } from "./snapshot-values";

const RULES = "catalog_teach_course_substitute_pool_list";
const DIRECTORY = "catalog_teach_course_group_";
const PATHS = "catalog_teach_course_groups";
const TREE = "catalog_teach_program_tree";
const PLANS = "catalog_teach_program_info";
const MODULES = "catalog_teach_course_module_info";
const MEMBERSHIPS = "catalog_teach_program_courses";

type RecordInput = Prisma.OfficialCatalogRecordCreateManyInput;
type CatalogSnapshot = Pick<Snapshot, "hasTable" | "rowCount" | "iterateAll">;

function requireValid(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(`Invalid official catalog: ${detail}`);
}

function json(value: unknown): Prisma.InputJsonObject | Prisma.InputJsonArray {
  requireValid(typeof value === "string", "missing source document");
  const parsed = JSON.parse(value);
  requireValid(parsed && typeof parsed === "object", "expected JSON document");
  return parsed;
}

function officialId(value: unknown) {
  requireValid(
    typeof value === "number" && Number.isSafeInteger(value) && value > 0,
    "invalid school ID",
  );
  return String(value);
}

function courseCode(value: unknown) {
  requireValid(
    typeof value === "string" && value.trim() === value && value.length > 0,
    "invalid course code",
  );
  return value;
}

function indexedCodes(codes: string[]) {
  return [...new Set(codes)].sort();
}

function available(
  snapshot: CatalogSnapshot,
  metadata: Readonly<Record<string, string>>,
  tables: string[],
) {
  if (
    !tables.every(
      (table) => snapshot.hasTable(table) && metadata[`${table}_count`] != null,
    )
  )
    return false;
  for (const table of tables) {
    const count = metadata[`${table}_count`];
    requireValid(
      /^\d+$/.test(count) && Number(count) === snapshot.rowCount(table),
      `${table} count differs from metadata`,
    );
  }
  return true;
}

function ruleRecords(snapshot: CatalogSnapshot): RecordInput[] {
  return Array.from(snapshot.iterateAll(RULES), (row) => {
    const key = officialId(row.id);
    const payload = json(row.payload_json) as Prisma.InputJsonObject;
    const { originalCourses, substituteCourses } = payload;
    requireValid(
      String(payload.id) === key &&
        Array.isArray(originalCourses) &&
        originalCourses.length > 0 &&
        Array.isArray(substituteCourses) &&
        substituteCourses.length > 0,
      `substitution ${key}`,
    );
    const codes = [...originalCourses, ...substituteCourses].map((course) =>
      courseCode((course as Prisma.InputJsonObject)?.code),
    );
    return {
      source: "substitution",
      key,
      courseCodes: indexedCodes(codes),
      payload,
    };
  });
}

function directoryKey(row: SnapshotRow) {
  return `${row.source_kind}/${row.source_id}`;
}

function directoryRows(snapshot: CatalogSnapshot, table: string) {
  const bySource = new Map<string, SnapshotRow[]>();
  for (const row of snapshot.iterateAll(table)) {
    const key = directoryKey(row);
    const rows = bySource.get(key) ?? [];
    rows.push(row);
    bySource.set(key, rows);
  }
  return bySource;
}

function directoryRecords(snapshot: CatalogSnapshot) {
  const entries = directoryRows(snapshot, `${DIRECTORY}entries`);
  const members = directoryRows(snapshot, `${DIRECTORY}members`);
  const paths = directoryRows(snapshot, PATHS);
  const records = Array.from(
    snapshot.iterateAll(`${DIRECTORY}endpoints`),
    (row) => {
      const key = directoryKey(row);
      const routes = entries.get(key);
      requireValid(routes?.length, `directory source ${key} lacks routes`);
      const courseCodes = indexedCodes(
        (members.get(key) ?? []).map(({ course_code }) =>
          courseCode(course_code),
        ),
      );
      const groups = (paths.get(key) ?? []).map((path) => ({
        path: json(path.group_path_json),
        position: Number(path.group_position),
        displayLabelCn: String(path.display_label_cn),
      }));
      return {
        source: "directory",
        key,
        courseCodes,
        payload: {
          groups: json(row.payload_json),
          paths: groups,
          routes: routes.map((route) => ({
            key: String(route.route_key),
            routePosition: Number(route.route_position),
            sourcePosition: Number(route.source_position),
            nameCn: String(route.name_cn),
            nameEn: String(route.name_en),
          })),
        },
      };
    },
  );
  const keys = new Set(records.map(({ key }) => key));
  for (const key of [...entries.keys(), ...members.keys(), ...paths.keys()]) {
    requireValid(keys.has(key), `directory rows lack endpoint ${key}`);
  }
  return {
    records,
    groupPaths: snapshot.rowCount(PATHS),
    groupMembers: snapshot.rowCount(`${DIRECTORY}members`),
  };
}

function programRecords(snapshot: CatalogSnapshot): RecordInput[] {
  const tree = Array.from(snapshot.iterateAll(TREE));
  requireValid(
    tree.length === 1 && tree[0].id === 1,
    "invalid study plan tree",
  );
  requireValid(snapshot.rowCount(PLANS) > 0, "empty study plan index");
  return [
    {
      source: "program",
      key: "tree",
      courseCodes: [],
      payload: json(tree[0].payload_json),
    },
    ...Array.from(snapshot.iterateAll(PLANS), (row) => ({
      source: "program",
      key: `plan/${officialId(row.program_id)}`,
      courseCodes: [],
      payload: {
        summary: json(row.summary_json),
        detail: json(row.payload_json),
      },
    })),
    ...Array.from(snapshot.iterateAll(MODULES), (row) => {
      const id = officialId(row.module_id);
      const payload = json(row.payload_json) as Prisma.InputJsonObject;
      const identity = payload.self as Prisma.InputJsonObject | undefined;
      requireValid(String(identity?.id) === id, `public module ${id} identity`);
      return {
        source: "program",
        key: `module/${id}`,
        courseCodes: [],
        payload,
      };
    }),
  ];
}

export function loadRelatedCatalog(
  snapshot: CatalogSnapshot,
  metadata: Readonly<Record<string, string>>,
) {
  const sources = [
    ...["entries", "endpoints", "members"].map((suffix) => DIRECTORY + suffix),
    PATHS,
  ];
  const rules = available(snapshot, metadata, [RULES])
    ? ruleRecords(snapshot)
    : undefined;
  const directory = available(snapshot, metadata, sources)
    ? directoryRecords(snapshot)
    : undefined;
  const programs =
    snapshot.hasTable(TREE) &&
    available(snapshot, metadata, [PLANS, MODULES, MEMBERSHIPS])
      ? programRecords(snapshot)
      : undefined;
  return { rules, directory, programs };
}

async function replaceSource(
  tx: Prisma.TransactionClient,
  source: string,
  rows?: RecordInput[],
) {
  if (!rows) return;
  requireValid(rows.length > 0, `empty source ${source}`);
  const ordered = [...rows].sort((first, second) =>
    first.key.localeCompare(second.key),
  );
  const hash = createHash("sha256");
  for (const row of ordered) hash.update(JSON.stringify(row)).update("\n");
  const digest = hash.digest("hex");
  if (
    (await tx.officialCatalogState.findUnique({ where: { source } }))
      ?.digest === digest
  )
    return;

  await tx.officialCatalogRecord.deleteMany({ where: { source } });
  for (const data of chunks(ordered, 25))
    await tx.officialCatalogRecord.createMany({ data });
  await tx.officialCatalogState.upsert({
    where: { source },
    create: { source, digest },
    update: { digest },
  });
}

export async function replaceRelatedCatalog(
  tx: Prisma.TransactionClient,
  { rules, directory, programs }: ReturnType<typeof loadRelatedCatalog>,
) {
  await replaceSource(tx, "substitution", rules);
  await replaceSource(tx, "directory", directory?.records);
  await replaceSource(tx, "program", programs);
  return {
    substitutions: rules?.length,
    groupSources: directory?.records.length,
    groupPaths: directory?.groupPaths,
    groupMembers: directory?.groupMembers,
    studyPlans: programs?.filter(({ key }) => key.startsWith("plan/")).length,
    publicModules: programs?.filter(({ key }) => key.startsWith("module/"))
      .length,
  };
}
