import type { TeacherBuild } from "./identity-types";

export type TeacherOccurrence = {
  sectionJwId: number;
  semesterCode: number;
  sourceOrder: number;
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

function teacherSignature(teacher: TeacherBuild): string {
  return JSON.stringify(
    Object.entries(teacher)
      .filter(([, value]) => value != null && value !== "")
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function compareOccurrences(
  left: TeacherOccurrence,
  right: TeacherOccurrence,
): number {
  return (
    left.semesterCode - right.semesterCode ||
    left.sourceOrder - right.sourceOrder ||
    teacherSignature(left.teacher).localeCompare(
      teacherSignature(right.teacher),
    )
  );
}

function mergeOccurrences(occurrences: TeacherOccurrence[]): TeacherBuild {
  const ranks = new Map<string, string>();
  for (const occurrence of occurrences) {
    const rank = `${occurrence.semesterCode}:${occurrence.sourceOrder}`;
    const signature = teacherSignature(occurrence.teacher);
    const existing = ranks.get(rank);
    if (existing != null && existing !== signature) {
      throw new Error(
        `Conflicting teacher metadata for ${stableIdentityKey(occurrence.teacher)} at ${rank}`,
      );
    }
    ranks.set(rank, signature);
  }

  const ordered = [...occurrences].sort(compareOccurrences);
  const merged: TeacherBuild = { nameCn: ordered[0].teacher.nameCn };
  for (const { teacher } of ordered) {
    for (const [key, value] of Object.entries(teacher)) {
      if (value == null || value === "") continue;
      Object.assign(merged, { [key]: value });
    }
  }
  return merged;
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
