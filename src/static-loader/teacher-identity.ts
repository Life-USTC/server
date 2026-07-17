import type { TeacherBuild } from "./identity-types";

export type TeacherOccurrence = {
  sectionJwId: number;
  semesterCode: number;
  teacher: TeacherBuild;
};

export type TeacherIdentityReference = Pick<
  TeacherBuild,
  "personId" | "teacherId" | "code"
>;

export type TeacherImportPlan = {
  teachers: TeacherBuild[];
  sectionTeacherIdentities: Map<string, TeacherIdentityReference>;
};

export function sectionTeacherNameKey(
  sectionJwId: number,
  nameCn: string,
): string {
  return `${sectionJwId}:${nameCn}`;
}

function stableIdentityKey(teacher: TeacherBuild): string {
  if (teacher.personId != null) return `person:${teacher.personId}`;
  if (teacher.teacherId != null) return `teacher:${teacher.teacherId}`;
  if (teacher.code != null && teacher.code !== "") {
    return `code:${teacher.code}`;
  }
  return `fallback:${teacher.nameCn}:${teacher.departmentCode ?? ""}`;
}

function fallbackIdentityKey(teacher: TeacherBuild): string {
  return `${teacher.nameCn}:${teacher.departmentCode ?? ""}`;
}

const teacherFields = [
  "personId",
  "teacherId",
  "code",
  "nameCn",
  "nameEn",
  "age",
  "email",
  "telephone",
  "mobile",
  "address",
  "postcode",
  "qq",
  "wechat",
  "departmentCode",
  "teacherTitleId",
] as const satisfies readonly (keyof TeacherBuild)[];

function mergeOccurrences(occurrences: TeacherOccurrence[]): TeacherBuild {
  const bySemester = new Map<number, TeacherOccurrence[]>();
  for (const occurrence of occurrences) {
    const semester = bySemester.get(occurrence.semesterCode) ?? [];
    semester.push(occurrence);
    bySemester.set(occurrence.semesterCode, semester);
  }

  const merged: Partial<TeacherBuild> = {};
  for (const [, semesterOccurrences] of [...bySemester].sort(
    ([left], [right]) => left - right,
  )) {
    for (const field of teacherFields) {
      const values = semesterOccurrences
        .map(({ teacher }) => teacher[field])
        .filter(
          (value): value is string | number => value != null && value !== "",
        );
      if (values.length === 0) continue;

      const counts = new Map<string | number, number>();
      for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      const highestCount = Math.max(...counts.values());
      const canonical = [...counts]
        .filter(([, count]) => count === highestCount)
        .map(([value]) => value)
        .sort(compareCanonicalValues)[0];
      Object.assign(merged, { [field]: canonical });
    }
  }

  if (merged.nameCn == null) {
    throw new Error("Teacher metadata is missing nameCn");
  }
  return merged as TeacherBuild;
}

function compareCanonicalValues(
  left: string | number,
  right: string | number,
): number {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  if (typeof left === "number") return -1;
  if (typeof right === "number") return 1;
  return left < right ? -1 : left > right ? 1 : 0;
}

function identityReference(teacher: TeacherBuild): TeacherIdentityReference {
  return {
    ...(teacher.personId == null ? {} : { personId: teacher.personId }),
    ...(teacher.teacherId == null ? {} : { teacherId: teacher.teacherId }),
    ...(teacher.code == null || teacher.code === ""
      ? {}
      : { code: teacher.code }),
  };
}

function groupBySectionName(
  occurrences: TeacherOccurrence[],
): Map<string, TeacherOccurrence[]> {
  const groups = new Map<string, TeacherOccurrence[]>();
  for (const occurrence of occurrences) {
    const key = sectionTeacherNameKey(
      occurrence.sectionJwId,
      occurrence.teacher.nameCn,
    );
    const group = groups.get(key) ?? [];
    group.push(occurrence);
    groups.set(key, group);
  }
  return groups;
}

export function planTeacherImport(
  scheduleOccurrences: TeacherOccurrence[],
  catalogOccurrences: TeacherOccurrence[],
): TeacherImportPlan {
  const scheduleBySectionName = groupBySectionName(scheduleOccurrences);
  const catalogBySectionName = groupBySectionName(catalogOccurrences);
  const matchedCatalog = new Set<TeacherOccurrence>();
  const catalogMetadataBySectionName = new Map<string, TeacherBuild>();
  const sectionTeacherIdentities = new Map<string, TeacherIdentityReference>();

  for (const [key, scheduleGroup] of scheduleBySectionName) {
    const catalogGroup = catalogBySectionName.get(key);
    if (catalogGroup == null) continue;

    const scheduleIdentities = new Set(
      scheduleGroup.map(({ teacher }) => stableIdentityKey(teacher)),
    );
    const catalogIdentities = new Set(
      catalogGroup.map(({ teacher }) => fallbackIdentityKey(teacher)),
    );
    if (scheduleIdentities.size !== 1 || catalogIdentities.size !== 1) {
      continue;
    }

    const scheduleTeacher = mergeOccurrences(scheduleGroup);
    const catalogTeacher = mergeOccurrences(catalogGroup);
    catalogMetadataBySectionName.set(key, catalogTeacher);
    sectionTeacherIdentities.set(key, identityReference(scheduleTeacher));
    for (const occurrence of catalogGroup) {
      matchedCatalog.add(occurrence);
    }
  }

  const enrichedSchedule = scheduleOccurrences.map((occurrence) => {
    const key = sectionTeacherNameKey(
      occurrence.sectionJwId,
      occurrence.teacher.nameCn,
    );
    const catalogTeacher = catalogMetadataBySectionName.get(key);
    if (catalogTeacher == null) return occurrence;
    return {
      ...occurrence,
      teacher: {
        ...occurrence.teacher,
        ...(catalogTeacher.nameEn == null
          ? {}
          : { nameEn: catalogTeacher.nameEn }),
        ...(catalogTeacher.departmentCode == null
          ? {}
          : { departmentCode: catalogTeacher.departmentCode }),
      },
    };
  });

  const grouped = new Map<string, TeacherOccurrence[]>();
  for (const occurrence of [
    ...enrichedSchedule,
    ...catalogOccurrences.filter((item) => !matchedCatalog.has(item)),
  ]) {
    const key = stableIdentityKey(occurrence.teacher);
    const group = grouped.get(key) ?? [];
    group.push(occurrence);
    grouped.set(key, group);
  }

  const teachers = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, occurrences]) => mergeOccurrences(occurrences));

  return { teachers, sectionTeacherIdentities };
}
