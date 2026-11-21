import type { CourseBuild } from "./mappers";
import type { Snapshot } from "./snapshot";
import { asString, type SnapshotRow } from "./snapshot-values";

export {
  findOfficialCourseConflicts,
  upsertOfficialProfiles,
} from "./catalog-profile-writes";

const COURSE_TABLE = "catalog_teach_course_infos";
const SECTION_TABLE = "catalog_teach_lesson_infos";
type ProfileSnapshot = Pick<Snapshot, "hasTable" | "iterateAll">;

type Profile = {
  jwId: number;
  code: string;
  payloadJson: string;
};

export type OfficialCourse = Profile & CourseBuild;
export type OfficialSection = Profile & {
  semesterJwId: number;
  courseJwId: number;
};

export type CatalogProfiles = {
  courses: OfficialCourse[];
  sections: OfficialSection[];
  courseIdentityConflicts: number;
  sectionIdentityConflicts: number;
};

function jwId(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 2_147_483_647
    ? value
    : undefined;
}

function parseProfile(row: SnapshotRow) {
  const id = jwId(row.id);
  const code = asString(row.code);
  const payloadJson = row.payload_json;
  if (!id || !code || code !== row.code || typeof payloadJson !== "string")
    return;
  try {
    const payload = JSON.parse(payloadJson) as SnapshotRow | null;
    if (payload?.id === id && payload.code === code)
      return { jwId: id, code, payloadJson, payload };
  } catch {
    // Malformed documents cannot establish identity.
  }
}

function officialCourse(row: SnapshotRow): OfficialCourse | undefined {
  const source = parseProfile(row);
  if (!source) return;
  const { jwId, code, payloadJson, payload } = source;
  const localized = payload.name as SnapshotRow | undefined;
  const nameEn = asString(localized?.en);
  return {
    jwId,
    code,
    payloadJson,
    nameCn: asString(localized?.cn) ?? nameEn ?? code,
    nameEn,
    categoryName: asString(payload.courseCategory),
    classifyName: asString(payload.courseClassify),
    typeName: asString(payload.courseType),
  };
}

function officialSection(row: SnapshotRow): OfficialSection | undefined {
  const source = parseProfile(row);
  if (!source) return;
  const course = jwId(row.courseId);
  const context = row.semester_id;
  const semester = jwId(
    typeof context === "string" && /^\d+$/.test(context)
      ? Number(context)
      : context,
  );
  if (course == null || semester == null || source.payload.courseId !== course)
    return;
  return {
    jwId: source.jwId,
    code: source.code,
    payloadJson: source.payloadJson,
    semesterJwId: semester,
    courseJwId: course,
  };
}

function readProfiles<T extends Profile>(
  snapshot: ProfileSnapshot,
  tables: string[],
  mapper: (row: SnapshotRow) => T | undefined,
  codeKey: (profile: T) => string,
) {
  const byId = new Map<number, T>();
  const byCode = new Map<string, number>();
  const conflicted = new Set<number>();
  let malformed = 0;
  for (const table of tables) {
    if (!snapshot.hasTable(table)) continue;
    const seen = new Set<number>();
    for (const row of snapshot.iterateAll(table)) {
      const profile = mapper(row);
      if (!profile) {
        const id = jwId(row.id);
        if (id == null) malformed++;
        else conflicted.add(id);
        continue;
      }
      const key = codeKey(profile);
      const known = byId.get(profile.jwId);
      if (
        seen.has(profile.jwId) ||
        (known &&
          (codeKey(known) !== key ||
            JSON.parse(known.payloadJson).courseId !==
              JSON.parse(profile.payloadJson).courseId))
      )
        conflicted.add(profile.jwId);
      seen.add(profile.jwId);
      const codeOwner = byCode.get(key);
      if (codeOwner != null && codeOwner !== profile.jwId) {
        conflicted.add(codeOwner);
        conflicted.add(profile.jwId);
      }
      const merged = known
        ? mapper({
            ...row,
            payload_json: JSON.stringify(
              supplement(
                JSON.parse(known.payloadJson),
                JSON.parse(profile.payloadJson),
              ),
            ),
          })
        : profile;
      byId.set(profile.jwId, merged ?? profile);
      byCode.set(key, profile.jwId);
    }
  }

  return {
    profiles: [...byId.values()].filter(
      (profile) => !conflicted.has(profile.jwId),
    ),
    conflicts: malformed + conflicted.size,
  };
}

function supplement(primary: unknown, fallback: unknown): unknown {
  if (primary == null || primary === "")
    return fallback == null || fallback === "" ? primary : fallback;
  if (
    typeof primary !== "object" ||
    Array.isArray(primary) ||
    typeof fallback !== "object" ||
    fallback == null ||
    Array.isArray(fallback)
  )
    return primary;
  const result = { ...fallback } as Record<string, unknown>;
  for (const [key, value] of Object.entries(primary))
    result[key] = supplement(value, result[key]);
  return result;
}

export function loadCatalogProfiles(
  snapshot: ProfileSnapshot,
): CatalogProfiles {
  const courses = readProfiles(
    snapshot,
    [COURSE_TABLE, "jw_catalog_course_infos"],
    officialCourse,
    (profile) => profile.code,
  );
  const sections = readProfiles(
    snapshot,
    [SECTION_TABLE, "jw_catalog_lesson_infos"],
    officialSection,
    (profile) => `${profile.semesterJwId}:${profile.code}`,
  );
  return {
    courses: courses.profiles,
    sections: sections.profiles,
    courseIdentityConflicts: courses.conflicts,
    sectionIdentityConflicts: sections.conflicts,
  };
}

export function officialCourseBuilds(
  courses: CourseBuild[],
  profiles: CatalogProfiles,
) {
  const ids = new Set(courses.map(({ jwId }) => jwId));
  const codes = new Set(courses.map(({ code }) => code));
  return profiles.courses.filter(
    ({ jwId, code }) => !ids.has(jwId) && !codes.has(code),
  );
}
