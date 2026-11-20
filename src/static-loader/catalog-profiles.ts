import type { loadCatalogLookups } from "./catalog-plan";
import type { CourseBuild } from "./mappers";
import type { Snapshot } from "./snapshot";
import type { SnapshotRow } from "./snapshot-values";

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

export type OfficialCourse = Profile & { course: CourseBuild };
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

function record(value: unknown): SnapshotRow | undefined {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as SnapshotRow)
    : undefined;
}

function jwId(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 2_147_483_647
    ? value
    : undefined;
}

function semesterJwId(value: unknown): number | undefined {
  return jwId(
    typeof value === "string" && /^[0-9]+$/.test(value) ? Number(value) : value,
  );
}

function code(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" && value === value.trim()
    ? value
    : undefined;
}

function name(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function parseProfile(row: SnapshotRow) {
  const id = jwId(row.id);
  const publicCode = code(row.code);
  const payloadJson = row.payload_json;
  if (id == null || publicCode == null || typeof payloadJson !== "string")
    return;
  let payload: SnapshotRow | undefined;
  try {
    payload = record(JSON.parse(payloadJson));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return;
  }
  if (!payload || payload.id !== id || payload.code !== publicCode) return;
  return { jwId: id, code: publicCode, payloadJson, payload };
}

function officialCourse(row: SnapshotRow): OfficialCourse | undefined {
  const source = parseProfile(row);
  if (!source) return;
  const { jwId: id, code: publicCode, payloadJson, payload } = source;
  const localized = record(payload.name);
  const nameEn = name(localized?.en);
  return {
    jwId: id,
    code: publicCode,
    payloadJson,
    course: {
      jwId: id,
      code: publicCode,
      nameCn: name(localized?.cn) ?? nameEn ?? publicCode,
      nameEn,
      categoryName: name(payload.courseCategory),
      classifyName: name(payload.courseClassify),
      typeName: name(payload.courseType),
    },
  };
}

function officialSection(row: SnapshotRow): OfficialSection | undefined {
  const source = parseProfile(row);
  if (!source) return;
  const course = jwId(row.courseId);
  const semester = semesterJwId(row.semester_id);
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
  table: string,
  mapper: (row: SnapshotRow) => T | undefined,
  codeKey: (profile: T) => string,
): { profiles: T[]; conflicts: number } {
  if (!snapshot.hasTable(table)) return { profiles: [], conflicts: 0 };

  const byId = new Map<number, T>();
  const byCode = new Map<string, number>();
  const conflicted = new Set<number>();
  let malformed = 0;
  for (const row of snapshot.iterateAll(table)) {
    const profile = mapper(row);
    if (!profile) {
      const id = jwId(row.id);
      if (id == null) malformed++;
      else conflicted.add(id);
      continue;
    }
    const key = codeKey(profile);
    const idOwner = byId.get(profile.jwId);
    const codeOwner = byCode.get(key);
    if (
      idOwner &&
      (codeKey(idOwner) !== key || idOwner.payloadJson !== profile.payloadJson)
    ) {
      conflicted.add(profile.jwId);
    }
    if (codeOwner != null && codeOwner !== profile.jwId) {
      conflicted.add(codeOwner);
      conflicted.add(profile.jwId);
    }
    byId.set(profile.jwId, profile);
    byCode.set(key, profile.jwId);
  }

  return {
    profiles: [...byId.values()].filter(
      (profile) => !conflicted.has(profile.jwId),
    ),
    conflicts: malformed + conflicted.size,
  };
}

export function loadCatalogProfiles(
  snapshot: ProfileSnapshot,
): CatalogProfiles {
  const courses = readProfiles(
    snapshot,
    COURSE_TABLE,
    officialCourse,
    (profile) => profile.code,
  );
  const sections = readProfiles(
    snapshot,
    SECTION_TABLE,
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

/** Keep archive-backed identity and attributes. A profile can create a course
 * only when neither its durable ID nor its code is already represented. */
export function mergeOfficialCourses(
  courses: CourseBuild[],
  profiles: CatalogProfiles,
): CourseBuild[] {
  const ids = new Set(courses.map((course) => course.jwId));
  const codes = new Set(courses.map((course) => course.code));
  return [
    ...courses,
    ...profiles.courses
      .filter((profile) => !ids.has(profile.jwId) && !codes.has(profile.code))
      .map((profile) => profile.course),
  ];
}

type CatalogLookups = ReturnType<typeof loadCatalogLookups>;

function mergeLookups(
  items: CatalogLookups["courseCategories"],
  names: Iterable<string | undefined>,
) {
  const lookup = new Map(items.map((item) => [item.nameCn, item]));
  for (const nameCn of names) {
    if (nameCn != null && !lookup.has(nameCn)) {
      lookup.set(nameCn, { nameCn, nameEn: undefined });
    }
  }
  return [...lookup.values()];
}

export function officialCourseLookups(
  lookups: CatalogLookups,
  officialOnly: CourseBuild[],
): CatalogLookups {
  return {
    ...lookups,
    courseCategories: mergeLookups(
      lookups.courseCategories,
      officialOnly.map((course) => course.categoryName),
    ),
    courseClassifies: mergeLookups(
      lookups.courseClassifies,
      officialOnly.map((course) => course.classifyName),
    ),
    courseTypes: mergeLookups(
      lookups.courseTypes,
      officialOnly.map((course) => course.typeName),
    ),
  };
}
