const SYNTHETIC_JWID_BASE = 1_500_000_000;
const SYNTHETIC_JWID_SPAN = 400_000_000;

async function loaderSha256Hex(input: string): Promise<string> {
  const crypto = globalThis.crypto;
  if (crypto == null) {
    throw new Error("Web Crypto is not available in the static loader runtime");
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export type CourseSourceIdentityRecord = {
  jwId: number;
  code: string;
  nameCn: string;
  nameEn?: string | null;
  categoryName?: string | null;
  classTypeName?: string | null;
  classifyName?: string | null;
  educationLevelName?: string | null;
  gradationName?: string | null;
  typeName?: string | null;
};

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

export type IncomingCourseIdentityRecord = CourseIdentityRecord & {
  sourceKey: string;
};

export type CourseIdentityImportPlan = {
  canonicalCourses: CourseIdentityRecord[];
  canonicalJwIdBySourceKey: Map<string, number>;
};

export type SyntheticCourseJwId = (sourceKey: string) => Promise<number>;

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

/**
 * Stable semantic identity emitted by the snapshot. Database surrogate IDs and
 * the upstream jwId are intentionally excluded so rebuilds and source-ID churn
 * cannot change the key.
 */
export function courseSourceIdentityKey(
  course: CourseSourceIdentityRecord,
): string {
  return JSON.stringify([
    normalizeRequiredString(course.code, `code for source jwId ${course.jwId}`),
    normalizeRequiredString(
      course.nameCn,
      `nameCn for source jwId ${course.jwId}`,
    ),
    normalizeOptionalString(course.nameEn),
    normalizeOptionalString(course.categoryName),
    normalizeOptionalString(course.classTypeName),
    normalizeOptionalString(course.classifyName),
    normalizeOptionalString(course.educationLevelName),
    normalizeOptionalString(course.gradationName),
    normalizeOptionalString(course.typeName),
  ]);
}

/** Full persisted identity used for matching rows inside one database. */
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

export const stableSyntheticCourseJwId: SyntheticCourseJwId = async (
  sourceKey,
) => {
  const digest = await loaderSha256Hex(`course-variant:v1:${sourceKey}`);
  return (
    SYNTHETIC_JWID_BASE +
    (Number.parseInt(digest.slice(0, 8), 16) % SYNTHETIC_JWID_SPAN)
  );
};

type IncomingIdentityGroup = {
  sourceKey: string;
  signature: string;
  courses: IncomingCourseIdentityRecord[];
  sourceJwIds: Set<number>;
};

function formatJwIds(courses: CourseIdentityRecord[]) {
  return courses
    .map((course) => course.jwId)
    .sort((left, right) => left - right)
    .join(", ");
}

/**
 * Resolve per-lesson semantic identities to stable Course rows without moving
 * existing relations. A raw source jwId is only a hint after a complete
 * identity match; it never authorizes overwriting a different stored variant.
 */
export async function planCourseIdentityImport(
  incomingCourses: IncomingCourseIdentityRecord[],
  existingCourses: CourseIdentityRecord[],
  createSyntheticJwId: SyntheticCourseJwId = stableSyntheticCourseJwId,
): Promise<CourseIdentityImportPlan> {
  const incomingBySourceKey = new Map<string, IncomingIdentityGroup>();
  for (const course of incomingCourses) {
    const sourceKey = normalizeRequiredString(
      course.sourceKey,
      `identity key for source jwId ${course.jwId}`,
    );
    const signature = courseIdentitySignature(course);
    const group = incomingBySourceKey.get(sourceKey);
    if (group != null && group.signature !== signature) {
      throw new Error(
        `Course identity key for source jwId ${course.jwId} maps to conflicting metadata in the same snapshot`,
      );
    }
    if (group != null) {
      group.courses.push({ ...course, sourceKey });
      group.sourceJwIds.add(course.jwId);
      continue;
    }
    incomingBySourceKey.set(sourceKey, {
      sourceKey,
      signature,
      courses: [{ ...course, sourceKey }],
      sourceJwIds: new Set([course.jwId]),
    });
  }

  const existingBySignature = new Map<string, CourseIdentityRecord[]>();
  const existingByJwId = new Map<number, CourseIdentityRecord>();
  for (const course of existingCourses) {
    if (existingByJwId.has(course.jwId)) {
      throw new Error(`Multiple stored Course rows use jwId ${course.jwId}`);
    }
    existingByJwId.set(course.jwId, course);
    const signature = courseIdentitySignature(course);
    const matches = existingBySignature.get(signature) ?? [];
    matches.push(course);
    existingBySignature.set(signature, matches);
  }

  const groups = [...incomingBySourceKey.values()].sort((left, right) =>
    left.sourceKey < right.sourceKey
      ? -1
      : left.sourceKey > right.sourceKey
        ? 1
        : 0,
  );
  const canonicalCourses: CourseIdentityRecord[] = [];
  const canonicalJwIdBySourceKey = new Map<string, number>();
  const plannedJwIds = new Set<number>();

  for (const group of groups) {
    const identityMatches = existingBySignature.get(group.signature) ?? [];
    const exactMatches = identityMatches.filter((course) =>
      group.sourceJwIds.has(course.jwId),
    );
    const code = normalizedCourseCode(group.courses[0]);

    if (exactMatches.length > 1) {
      throw new Error(
        `Ambiguous course identity for code "${code}": source jwIds ${formatJwIds(exactMatches)} already exist as separate Course rows`,
      );
    }

    let canonicalJwId: number;
    if (exactMatches.length === 1) {
      canonicalJwId = exactMatches[0].jwId;
    } else {
      if (identityMatches.length > 1) {
        throw new Error(
          `Ambiguous stored course identity for code "${code}": ${identityMatches.length} matching Course rows exist`,
        );
      }
      canonicalJwId =
        identityMatches[0]?.jwId ??
        (await createSyntheticJwId(group.sourceKey));
    }

    if (plannedJwIds.has(canonicalJwId)) {
      throw new Error(
        `Course jwId ${canonicalJwId} was assigned to multiple identities`,
      );
    }
    const occupied = existingByJwId.get(canonicalJwId);
    if (
      occupied != null &&
      courseIdentitySignature(occupied) !== group.signature
    ) {
      throw new Error(
        `Synthetic course jwId collision for code "${code}": ${canonicalJwId}`,
      );
    }

    const preferredCourse =
      group.courses.find((course) => course.jwId === canonicalJwId) ??
      group.courses[0];
    const { sourceKey: _sourceKey, ...course } = preferredCourse;
    canonicalCourses.push({ ...course, jwId: canonicalJwId });
    canonicalJwIdBySourceKey.set(group.sourceKey, canonicalJwId);
    plannedJwIds.add(canonicalJwId);
  }

  return { canonicalCourses, canonicalJwIdBySourceKey };
}
