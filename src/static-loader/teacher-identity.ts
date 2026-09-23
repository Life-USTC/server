import type { TeacherBuild } from "./identity-types";

export type TeacherOccurrence = {
  sectionJwId: number;
  semesterCode: number;
  teacher: TeacherBuild;
};

export type CatalogTeacherOccurrence = {
  sectionJwId: number;
  semesterCode: number;
  teacher: {
    nameCn: string;
    nameEn?: string;
    departmentCode?: string;
  };
};

export type TeacherImportPlan = {
  teachers: TeacherBuild[];
  catalogTeacherJwIdBySectionName: Map<string, number>;
};

export function sectionTeacherNameKey(
  sectionJwId: number,
  nameCn: string,
): string {
  return `${sectionJwId}:${nameCn}`;
}

export function planTeacherImport(
  scheduleOccurrences: readonly TeacherOccurrence[],
  catalogOccurrences: readonly CatalogTeacherOccurrence[],
): TeacherImportPlan {
  const teacherJwIdsBySectionName = new Map<string, Set<number>>();
  for (const occurrence of scheduleOccurrences) {
    const key = sectionTeacherNameKey(
      occurrence.sectionJwId,
      occurrence.teacher.nameCn,
    );
    const ids = teacherJwIdsBySectionName.get(key) ?? new Set<number>();
    ids.add(occurrence.teacher.jwId);
    teacherJwIdsBySectionName.set(key, ids);
  }

  const catalogTeacherJwIdBySectionName = new Map<string, number>();
  const catalogMetadataByTeacherJwId = new Map<
    number,
    CatalogTeacherOccurrence[]
  >();
  for (const occurrence of catalogOccurrences) {
    const key = sectionTeacherNameKey(
      occurrence.sectionJwId,
      occurrence.teacher.nameCn,
    );
    const ids = teacherJwIdsBySectionName.get(key);
    if (ids?.size !== 1) continue;
    const teacherJwId = [...ids][0];
    catalogTeacherJwIdBySectionName.set(key, teacherJwId);
    const metadata = catalogMetadataByTeacherJwId.get(teacherJwId) ?? [];
    metadata.push(occurrence);
    catalogMetadataByTeacherJwId.set(teacherJwId, metadata);
  }

  const byTeacherJwId = new Map<number, TeacherOccurrence[]>();
  for (const occurrence of scheduleOccurrences) {
    const group = byTeacherJwId.get(occurrence.teacher.jwId) ?? [];
    group.push(occurrence);
    byTeacherJwId.set(occurrence.teacher.jwId, group);
  }

  const teachers = [...byTeacherJwId]
    .sort(([left], [right]) => left - right)
    .map(([teacherJwId, occurrences]) =>
      mergeTeacherOccurrences(
        teacherJwId,
        occurrences,
        catalogMetadataByTeacherJwId.get(teacherJwId) ?? [],
      ),
    );

  return { teachers, catalogTeacherJwIdBySectionName };
}

const metadataFields = [
  "personId",
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
] as const satisfies readonly (keyof TeacherBuild)[];

function mergeTeacherOccurrences(
  teacherJwId: number,
  occurrences: readonly TeacherOccurrence[],
  catalogOccurrences: readonly CatalogTeacherOccurrence[],
): TeacherBuild {
  const latestSemester = Math.max(
    ...occurrences.map((occurrence) => occurrence.semesterCode),
  );
  const merged: Partial<TeacherBuild> = {
    jwId: teacherJwId,
  };
  for (const semester of [
    ...new Set(occurrences.map((occurrence) => occurrence.semesterCode)),
  ].sort((a, b) => a - b)) {
    const semesterOccurrences = occurrences.filter(
      (occurrence) => occurrence.semesterCode === semester,
    );
    for (const field of metadataFields) {
      const value = canonicalValue(
        semesterOccurrences.map(({ teacher }) => teacher[field]),
      );
      if (value != null) Object.assign(merged, { [field]: value });
    }
  }

  const catalog = catalogOccurrences.filter(
    (occurrence) => occurrence.semesterCode === latestSemester,
  );
  const catalogNameEn = canonicalValue(
    catalog.map(({ teacher }) => teacher.nameEn),
  );
  const catalogDepartmentCode = canonicalValue(
    catalog.map(({ teacher }) => teacher.departmentCode),
  );
  if (catalogNameEn != null) merged.nameEn = catalogNameEn as string;
  if (catalogDepartmentCode != null) {
    merged.departmentCode = catalogDepartmentCode as string;
  }

  if (merged.nameCn == null) {
    throw new Error(`Teacher jwId ${teacherJwId} is missing nameCn`);
  }
  return merged as TeacherBuild;
}

function canonicalValue(
  values: readonly (string | number | undefined)[],
): string | number | undefined {
  const present = values.filter(
    (value): value is string | number => value != null && value !== "",
  );
  if (present.length === 0) return undefined;
  const counts = new Map<string | number, number>();
  for (const value of present) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].sort(
    ([leftValue, leftCount], [rightValue, rightCount]) => {
      if (leftCount !== rightCount) return rightCount - leftCount;
      return String(leftValue).localeCompare(String(rightValue));
    },
  )[0][0];
}
