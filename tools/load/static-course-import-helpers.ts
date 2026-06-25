type LookupCache = ReadonlyMap<string, number>;

export type StaticCourseLookupState = {
  courseTypeIdByName: LookupCache;
  courseGradationIdByName: LookupCache;
  courseCategoryIdByName: LookupCache;
  educationLevelIdByName: LookupCache;
  classTypeIdByName: LookupCache;
};

export type StaticCourseForImport = {
  course_code: string;
  name: string;
  course_type: string | null;
  course_gradation: string;
  course_category: string;
  education_type: string;
  class_type: string;
};

export type StaticCourseImportRow = {
  jwId: number;
  code: string;
  nameCn: string;
  typeId: number | null;
  gradationId: number | null;
  categoryId: number | null;
  educationLevelId: number | null;
  classTypeId: number | null;
  classifyId: null;
};

export type StaticTeacherReference = {
  nameCn: string;
  departmentName: string | null;
  source: string;
};

function normalizeName(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function splitStaticTeacherNames(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return [
    ...new Set(
      value
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function staticTeacherIdentityKey(reference: StaticTeacherReference) {
  const nameCn = normalizeName(reference.nameCn);
  if (!nameCn) {
    throw new Error("Static teacher reference is missing nameCn");
  }

  return JSON.stringify([
    "name+department",
    nameCn,
    normalizeName(reference.departmentName),
  ]);
}

function normalizeTeacherReference(reference: StaticTeacherReference) {
  const nameCn = normalizeName(reference.nameCn);
  if (!nameCn) {
    return null;
  }

  return {
    nameCn,
    departmentName: normalizeName(reference.departmentName),
    source: reference.source,
  } satisfies StaticTeacherReference;
}

export function assertStaticTeacherReferencesResolvable(
  references: StaticTeacherReference[],
) {
  const contextsByName = new Map<
    string,
    Map<string, { departmentName: string | null; sources: string[] }>
  >();

  for (const reference of references) {
    const normalized = normalizeTeacherReference(reference);
    if (!normalized) {
      continue;
    }
    const contextKey = normalized.departmentName ?? "";
    let contexts = contextsByName.get(normalized.nameCn);
    if (!contexts) {
      contexts = new Map();
      contextsByName.set(normalized.nameCn, contexts);
    }
    const context = contexts.get(contextKey);
    if (context) {
      context.sources.push(normalized.source);
    } else {
      contexts.set(contextKey, {
        departmentName: normalized.departmentName,
        sources: [normalized.source],
      });
    }
  }

  for (const [nameCn, contexts] of contextsByName) {
    const missingSources = contexts.get("")?.sources ?? [];
    if (missingSources.length === 0) {
      continue;
    }

    if (contexts.size > 1) {
      const scopedDepartments = [...contexts.values()]
        .map((context) => context.departmentName)
        .filter((departmentName): departmentName is string =>
          Boolean(departmentName),
        )
        .sort((left, right) => left.localeCompare(right));
      throw new Error(
        `Ambiguous static teacher identity for "${nameCn}": snapshot mixes missing department context (${missingSources
          .slice(0, 3)
          .join(", ")}) with department context (${scopedDepartments.join(
          ", ",
        )}).`,
      );
    }

    if (missingSources.length > 1) {
      throw new Error(
        `Ambiguous static teacher identity for "${nameCn}": snapshot has ${missingSources.length} references without department context (${missingSources
          .slice(0, 3)
          .join(", ")}).`,
      );
    }
  }
}

export function uniqueStaticTeacherReferences(
  references: StaticTeacherReference[],
) {
  assertStaticTeacherReferencesResolvable(references);

  const byKey = new Map<string, StaticTeacherReference>();
  for (const reference of references) {
    const normalized = normalizeTeacherReference(reference);
    if (!normalized) {
      continue;
    }
    byKey.set(staticTeacherIdentityKey(normalized), normalized);
  }
  return [...byKey.values()];
}

export function buildStaticCourseImportRows(
  courses: StaticCourseForImport[],
  state: StaticCourseLookupState,
  jwIdForCourseCode: (courseCode: string) => number,
): StaticCourseImportRow[] {
  return courses.map((course) => ({
    jwId: jwIdForCourseCode(course.course_code),
    code: course.course_code,
    nameCn: course.name,
    typeId: course.course_type
      ? (state.courseTypeIdByName.get(course.course_type) ?? null)
      : null,
    gradationId:
      state.courseGradationIdByName.get(course.course_gradation) ?? null,
    categoryId:
      state.courseCategoryIdByName.get(course.course_category) ?? null,
    educationLevelId:
      state.educationLevelIdByName.get(course.education_type) ?? null,
    classTypeId: state.classTypeIdByName.get(course.class_type) ?? null,
    classifyId: null,
  }));
}
