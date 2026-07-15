export type CourseIdentityRecord = {
  jwId: number;
  code: string;
  nameCn: string;
  nameEn?: string | null;
  categoryId?: number | null;
  classTypeId?: number | null;
  classifyId?: number | null;
  educationLevelId?: number | null;
  gradationId?: number | null;
  typeId?: number | null;
};

export type CourseIdentityImportPlan = {
  canonicalCourses: CourseIdentityRecord[];
  canonicalJwIdBySourceJwId: Map<number, number>;
};

function normalizeRequiredString(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Course ${label} is missing`);
  }
  return normalized;
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeOptionalId(value: number | null | undefined) {
  return value ?? null;
}

function normalizedCourseCode(course: CourseIdentityRecord) {
  return normalizeRequiredString(
    course.code,
    `code for source jwId ${course.jwId}`,
  );
}

export function courseIdentitySignature(course: CourseIdentityRecord): string {
  return JSON.stringify([
    normalizedCourseCode(course),
    normalizeRequiredString(
      course.nameCn,
      `nameCn for source jwId ${course.jwId}`,
    ),
    normalizeOptionalString(course.nameEn),
    normalizeOptionalId(course.categoryId),
    normalizeOptionalId(course.classTypeId),
    normalizeOptionalId(course.classifyId),
    normalizeOptionalId(course.educationLevelId),
    normalizeOptionalId(course.gradationId),
    normalizeOptionalId(course.typeId),
  ]);
}

function formatJwIds(courses: CourseIdentityRecord[]) {
  return courses
    .map((course) => course.jwId)
    .sort((left, right) => left - right)
    .join(", ");
}

/**
 * Resolve snapshot source IDs to stable Course rows without moving any existing
 * relations. Exact source IDs win; otherwise exactly one full metadata match
 * may be reused. Ambiguous stored duplicates abort the surrounding transaction
 * so an explicit data migration can decide which related records to preserve.
 */
export function planCourseIdentityImport(
  incomingCourses: CourseIdentityRecord[],
  existingCourses: CourseIdentityRecord[],
): CourseIdentityImportPlan {
  const incomingBySourceJwId = new Map<number, CourseIdentityRecord>();
  const incomingSignatureBySourceJwId = new Map<number, string>();

  for (const course of incomingCourses) {
    const signature = courseIdentitySignature(course);
    const previousSignature = incomingSignatureBySourceJwId.get(course.jwId);
    if (previousSignature != null && previousSignature !== signature) {
      throw new Error(
        `Conflicting course metadata for source jwId ${course.jwId} in the same snapshot`,
      );
    }
    if (previousSignature == null) {
      incomingBySourceJwId.set(course.jwId, course);
      incomingSignatureBySourceJwId.set(course.jwId, signature);
    }
  }

  const incomingBySignature = new Map<string, CourseIdentityRecord[]>();
  for (const course of incomingBySourceJwId.values()) {
    const signature = incomingSignatureBySourceJwId.get(course.jwId);
    if (signature == null) continue;
    const courses = incomingBySignature.get(signature) ?? [];
    courses.push(course);
    incomingBySignature.set(signature, courses);
  }

  const existingBySignature = new Map<string, CourseIdentityRecord[]>();
  const existingByJwId = new Map<number, CourseIdentityRecord>();
  for (const course of existingCourses) {
    existingByJwId.set(course.jwId, course);
    const signature = courseIdentitySignature(course);
    const courses = existingBySignature.get(signature) ?? [];
    courses.push(course);
    existingBySignature.set(signature, courses);
  }

  const canonicalCourses: CourseIdentityRecord[] = [];
  const canonicalJwIdBySourceJwId = new Map<number, number>();
  const sortedGroups = [...incomingBySignature.entries()].sort(
    ([left], [right]) => (left < right ? -1 : left > right ? 1 : 0),
  );

  for (const [signature, unsortedGroup] of sortedGroups) {
    const group = [...unsortedGroup].sort(
      (left, right) => left.jwId - right.jwId,
    );
    const code = normalizedCourseCode(group[0]);
    const exactMatches = group
      .map((course) => existingByJwId.get(course.jwId))
      .filter((course): course is CourseIdentityRecord => course != null);

    for (const match of exactMatches) {
      const storedCode = normalizedCourseCode(match);
      if (storedCode !== code) {
        throw new Error(
          `Course source jwId collision for ${match.jwId}: stored code "${storedCode}" does not match incoming code "${code}"`,
        );
      }
    }

    if (exactMatches.length > 1) {
      throw new Error(
        `Ambiguous course identity for code "${code}": source jwIds ${formatJwIds(exactMatches)} already exist as separate Course rows`,
      );
    }

    let canonicalJwId: number;
    if (exactMatches.length === 1) {
      canonicalJwId = exactMatches[0].jwId;
    } else {
      const identityMatches = (existingBySignature.get(signature) ?? []).filter(
        (course) => !incomingSignatureBySourceJwId.has(course.jwId),
      );
      if (identityMatches.length > 1) {
        throw new Error(
          `Ambiguous stored course identity for code "${code}": ${identityMatches.length} matching Course rows exist; merge them before importing source jwIds ${formatJwIds(group)}`,
        );
      }
      canonicalJwId = identityMatches[0]?.jwId ?? group[0].jwId;
    }

    const preferredCourse =
      group.find((course) => course.jwId === canonicalJwId) ?? group[0];
    canonicalCourses.push({ ...preferredCourse, jwId: canonicalJwId });
    for (const course of group) {
      canonicalJwIdBySourceJwId.set(course.jwId, canonicalJwId);
    }
  }

  return { canonicalCourses, canonicalJwIdBySourceJwId };
}
