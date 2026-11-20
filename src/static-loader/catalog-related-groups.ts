import {
  array,
  code,
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
import type { SnapshotRow } from "./snapshot-values";

const ENTRIES = "catalog_teach_course_group_entries";
const ENDPOINTS = "catalog_teach_course_group_endpoints";
const PATHS = "catalog_teach_course_groups";
const MEMBERS = "catalog_teach_course_group_members";

function identity(row: SnapshotRow) {
  const sourceKind = text(row.source_kind, "group source kind");
  const sourceId = text(row.source_id, "group source ID");
  requireCatalogValue(
    sourceKind === "quality"
      ? sourceId === ""
      : ["public", "department"].includes(sourceKind) && /^\d+$/.test(sourceId),
    `group source ${sourceKind}/${sourceId}`,
  );
  return { sourceKind, sourceId };
}

function sourceKey(row: ReturnType<typeof identity>) {
  return `${row.sourceKind}:${row.sourceId}`;
}

function pathParts(raw: unknown) {
  return array(json(raw, "group path"), "group path parts").map((part) =>
    text(part, "path part"),
  );
}

function rawGroups(root: Record<string, unknown> | unknown[]) {
  const groups = new Map<string, Record<string, unknown> | unknown[]>();
  function walk(node: Record<string, unknown>, parent: string[]) {
    for (const [name, value] of Object.entries(node)) {
      const path = [...parent, name];
      const group = Array.isArray(value)
        ? value
        : object(value, "raw catalog group");
      groups.set(JSON.stringify(path), group);
      if (!Array.isArray(group)) walk(group, path);
    }
  }
  if (!Array.isArray(root)) walk(root, []);
  return groups;
}

export function loadOfficialCourseGroups(
  snapshot: RelatedSnapshot,
  metadata: RelatedMetadata,
) {
  if (!countedTables(snapshot, metadata, [ENTRIES, ENDPOINTS, PATHS, MEMBERS]))
    return;
  const groups = new Map<string, ReturnType<typeof rawGroups>>();
  const sources = unique(
    snapshot.iterateAll(ENDPOINTS),
    (row) => {
      const source = identity(row);
      const payload = json(row.payload_json, ENDPOINTS);
      const root =
        Array.isArray(payload) && payload.length === 0
          ? payload
          : object(payload, "grouped endpoint");
      groups.set(sourceKey(source), rawGroups(root));
      return { ...source, payload: jsonDocument(root) };
    },
    sourceKey,
  );

  const entrySources = new Set<string>();
  const entries = unique(
    snapshot.iterateAll(ENTRIES),
    (row) => {
      const source = identity(row);
      const key = sourceKey(source);
      requireCatalogValue(sources.has(key), `entry missing source ${key}`);
      entrySources.add(key);
      return {
        ...source,
        routeKey: code(row.route_key, "group route key"),
        routePosition: integer(row.route_position, "group route position", 0),
        sourcePosition: integer(
          row.source_position,
          "group source position",
          0,
        ),
        nameCn: text(row.name_cn, "group route Chinese label"),
        nameEn: text(row.name_en, "group route English label"),
      };
    },
    (row) => `${row.routeKey}:${row.sourcePosition}`,
  );
  requireCatalogValue(
    sources.size > 0 && entrySources.size === sources.size,
    "all course group endpoints have route entries",
  );

  const memberArrays = new Map<string, unknown[]>();
  const paths = unique(
    snapshot.iterateAll(PATHS),
    (row) => {
      const source = identity(row);
      const parts = pathParts(row.group_path_json);
      const path = JSON.stringify(parts);
      const parentPath = JSON.stringify(pathParts(row.parent_group_path_json));
      const groupKey = text(row.group_key, "group leaf name");
      requireCatalogValue(
        parts.length > 0 &&
          parts.at(-1) === groupKey &&
          parentPath === JSON.stringify(parts.slice(0, -1)),
        `group path ${path} matches parent and leaf`,
      );
      const group = groups.get(sourceKey(source))?.get(path);
      requireCatalogValue(
        group != null,
        `source document missing group ${path}`,
      );
      const groupKind = Array.isArray(group) ? "array" : "object";
      const memberCount = Array.isArray(group) ? group.length : 0;
      requireCatalogValue(
        row.group_kind === groupKind && row.member_count === memberCount,
        `group ${path} shape`,
      );
      if (Array.isArray(group))
        memberArrays.set(`${sourceKey(source)}:${path}`, group);
      return {
        ...source,
        path,
        parentPath,
        groupKey,
        groupKind,
        memberCount,
        position: integer(row.group_position, "group sibling position", 0),
        displayLabelCn: text(
          row.display_label_cn,
          "group Chinese display label",
        ),
      };
    },
    (row) => `${sourceKey(row)}:${row.path}`,
  );
  const pathCount = [...groups.values()].reduce(
    (total, source) => total + source.size,
    0,
  );
  requireCatalogValue(paths.size === pathCount, "all raw groups indexed");

  const members = unique(
    snapshot.iterateAll(MEMBERS),
    (row) => {
      const source = identity(row);
      const path = JSON.stringify(pathParts(row.group_path_json));
      const position = integer(row.member_position, "group member position", 0);
      const courseCode = code(row.course_code, "group member course code");
      const raw = memberArrays.get(`${sourceKey(source)}:${path}`)?.[position];
      requireCatalogValue(
        raw != null && object(raw, "raw member").number === courseCode,
        `group member ${path}/${position} matches source course`,
      );
      return { ...source, path, position, courseCode };
    },
    (row) => `${sourceKey(row)}:${row.path}:${row.position}`,
  );
  const memberCount = [...memberArrays.values()].reduce(
    (total, group) => total + group.length,
    0,
  );
  requireCatalogValue(
    members.size > 0 && members.size === memberCount,
    "all raw group memberships indexed",
  );

  return {
    sources: [...sources.values()],
    entries: [...entries.values()],
    paths: [...paths.values()],
    members: [...members.values()],
  };
}
