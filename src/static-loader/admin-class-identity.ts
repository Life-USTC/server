import type { AdminClassBuild } from "./identity-types";

export type AdminClassOccurrence = {
  semesterCode: number;
  adminClass: AdminClassBuild;
};

export type AdminClassIdentityPlan = {
  canonicalBuilds: AdminClassBuild[];
  canonicalJwIdByAlias: Map<number, number>;
};

const adminClassFields = [
  "jwId",
  "code",
  "grade",
  "nameCn",
  "nameEn",
  "stdCount",
  "planCount",
  "enabled",
  "abbrZh",
  "abbrEn",
] as const satisfies readonly (keyof AdminClassBuild)[];

export function canonicalizeAdminClasses(
  occurrences: AdminClassOccurrence[],
): AdminClassIdentityPlan {
  const byName = new Map<string, AdminClassOccurrence[]>();
  for (const occurrence of occurrences) {
    const group = byName.get(occurrence.adminClass.nameCn) ?? [];
    group.push(occurrence);
    byName.set(occurrence.adminClass.nameCn, group);
  }

  const canonicalBuilds: AdminClassBuild[] = [];
  const canonicalJwIdByAlias = new Map<number, number>();
  for (const [, nameOccurrences] of [...byName].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  )) {
    const bySemester = new Map<number, AdminClassBuild[]>();
    for (const occurrence of nameOccurrences) {
      const semester = bySemester.get(occurrence.semesterCode) ?? [];
      semester.push(occurrence.adminClass);
      bySemester.set(occurrence.semesterCode, semester);
    }

    const canonical: Partial<AdminClassBuild> = {};
    for (const [, semesterBuilds] of [...bySemester].sort(
      ([left], [right]) => left - right,
    )) {
      const semesterCanonical = canonicalRecord(semesterBuilds);
      for (const field of adminClassFields) {
        const value = semesterCanonical[field];
        if (value != null && value !== "") {
          Object.assign(canonical, { [field]: value });
        }
      }
    }

    if (canonical.jwId == null || canonical.nameCn == null) {
      throw new Error("AdminClass canonical record is missing identity");
    }
    const build = canonical as AdminClassBuild;
    canonicalBuilds.push(build);
    for (const occurrence of nameOccurrences) {
      canonicalJwIdByAlias.set(occurrence.adminClass.jwId, build.jwId);
    }
  }

  return {
    canonicalBuilds: canonicalBuilds.sort(
      (left, right) => left.jwId - right.jwId,
    ),
    canonicalJwIdByAlias: new Map(
      [...canonicalJwIdByAlias].sort(
        ([leftAlias], [rightAlias]) => leftAlias - rightAlias,
      ),
    ),
  };
}

function canonicalRecord(builds: AdminClassBuild[]): AdminClassBuild {
  const counts = new Map<string, { build: AdminClassBuild; count: number }>();
  for (const build of builds) {
    const key = JSON.stringify(
      adminClassFields.map((field) => build[field] ?? null),
    );
    const current = counts.get(key);
    counts.set(key, { build, count: (current?.count ?? 0) + 1 });
  }

  return [...counts.values()].sort(
    (left, right) =>
      right.count - left.count ||
      compareAdminClassBuilds(left.build, right.build),
  )[0].build;
}

function compareAdminClassBuilds(
  left: AdminClassBuild,
  right: AdminClassBuild,
): number {
  for (const field of adminClassFields) {
    const result = compareValues(left[field], right[field]);
    if (result !== 0) return result;
  }
  return 0;
}

function compareValues(
  left: string | number | boolean | undefined,
  right: string | number | boolean | undefined,
): number {
  if (left == null || left === "") {
    return right == null || right === "" ? 0 : 1;
  }
  if (right == null || right === "") return -1;
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }
  const leftString = String(left);
  const rightString = String(right);
  return leftString < rightString ? -1 : leftString > rightString ? 1 : 0;
}
