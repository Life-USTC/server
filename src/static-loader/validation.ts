import * as z from "zod";

const CATALOG_LESSON_SOURCE = "catalog_teach_lesson_list_for_teach";
const CATALOG_EXAM_SOURCE = "catalog_teach_exam_list";
const JW_SCHEDULE_SOURCE = "jw_ws_schedule_table_datum";
const SNAPSHOT_MAX_FUTURE_SKEW_MS = 15 * 60 * 1000;
const SNAPSHOT_GENERATED_AT_SCHEMA = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/)
  .datetime({ offset: true });
const SEMESTER_SOURCES = new Set([
  CATALOG_LESSON_SOURCE,
  CATALOG_EXAM_SOURCE,
  JW_SCHEDULE_SOURCE,
]);

type SnapshotRow = Record<string, unknown>;

function rowString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const normalized = String(value).trim();
  return normalized === "" ? undefined : normalized;
}

function rowInteger(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : undefined;
  }
  const normalized = rowString(value);
  if (normalized == null || !/^-?\d+$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function rowBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  const normalized = rowString(value)?.toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
}

export function parseBooleanSetting(
  name: string,
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw new Error(`${name} must be one of: true, false, 1, 0`);
}

export function parsePositiveIntegerSetting(
  name: string,
  value: string | undefined,
  defaultValue: number,
): number {
  if (value === undefined) return defaultValue;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${name} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a safe positive integer`);
  }
  return parsed;
}

export function parseOptionalNonNegativeIntegerSetting(
  name: string,
  value: string | undefined,
): number | null {
  if (value == null || value.trim() === "") return null;
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a safe non-negative integer`);
  }
  return parsed;
}

export function parseOptionalSha256Setting(
  name: string,
  value: string | undefined,
): string | null {
  if (value == null || value.trim() === "") return null;
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error(`${name} must be a 64-character SHA-256 digest`);
  }
  return normalized;
}

export function parseSnapshotGeneratedAt(
  value: string | undefined,
  now = new Date(),
): Date {
  if (value == null || value.trim() === "") {
    throw new Error("snapshot metadata generated_at is required");
  }
  if (!SNAPSHOT_GENERATED_AT_SCHEMA.safeParse(value).success) {
    throw new Error(
      "snapshot metadata generated_at must be a valid timestamp in RFC 3339 format",
    );
  }
  const parsed = new Date(value);
  if (parsed.getTime() > now.getTime() + SNAPSHOT_MAX_FUTURE_SKEW_MS) {
    throw new Error(
      "snapshot metadata generated_at must not be more than 15 minutes in the future",
    );
  }
  return parsed;
}

export function validateSectionRetirementSnapshotApproval(input: {
  enabled: boolean;
  expectedSnapshotSha256: string | null;
  snapshotSha256: string;
}): void {
  if (!input.enabled) return;
  if (input.expectedSnapshotSha256 == null) {
    throw new Error(
      "STATIC_LOADER_EXPECTED_SNAPSHOT_SHA256 is required when missing-Section retirement is enabled",
    );
  }
  if (input.expectedSnapshotSha256 !== input.snapshotSha256) {
    throw new Error(
      `Approved static snapshot SHA-256 ${input.expectedSnapshotSha256} does not match downloaded snapshot ${input.snapshotSha256}`,
    );
  }
}

function optionalNonNegativeIntegerMetadata(
  name: string,
  value: string | undefined,
): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) {
    throw new Error(`snapshot metadata ${name} must be a non-negative integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`snapshot metadata ${name} must be a safe integer`);
  }
  return parsed;
}

type SnapshotCompletenessInput = {
  metadata: Record<string, string>;
  semesterRows: SnapshotRow[];
  catalogLessonRows: SnapshotRow[];
  fetchRows: SnapshotRow[];
};

export type SnapshotCompleteness = {
  sectionJwIds: number[];
  sectionSemesterJwIds: number[];
};

type SemesterFetchState = {
  catalogLessonFetches: number;
  catalogExamFetches: number;
  jwChunks: number[];
};

function fetchContext(row: SnapshotRow): URLSearchParams {
  const context = rowString(row.context);
  if (context == null) {
    throw new Error(
      `Snapshot fetch ${rowString(row.source) ?? "unknown"} has no context`,
    );
  }
  return new URLSearchParams(context);
}

function contextInteger(
  source: string,
  context: URLSearchParams,
  name: string,
): number {
  const value = context.get(name);
  if (value == null || !/^\d+$/.test(value)) {
    throw new Error(`Snapshot fetch ${source} has invalid ${name}`);
  }
  return Number(value);
}

export function validateSnapshotCompleteness(
  input: SnapshotCompletenessInput,
  minSemester: number,
): SnapshotCompleteness {
  const chunkSize = parsePositiveIntegerSetting(
    "snapshot metadata jw_schedule_chunk_size",
    input.metadata.jw_schedule_chunk_size,
    100,
  );
  const examMinSemester = parsePositiveIntegerSetting(
    "snapshot metadata catalog_exam_min_semester_id",
    input.metadata.catalog_exam_min_semester_id,
    381,
  );

  const targetSemesters = new Set(
    input.semesterRows
      .map((row) => rowInteger(row.id))
      .filter(
        (semesterId): semesterId is number =>
          semesterId != null && semesterId >= minSemester,
      ),
  );
  const lessonCounts = new Map<number, number>();
  const sectionJwIds = new Set<number>();
  const fetchState = new Map<number, SemesterFetchState>();
  for (const semesterId of targetSemesters) {
    lessonCounts.set(semesterId, 0);
    fetchState.set(semesterId, {
      catalogLessonFetches: 0,
      catalogExamFetches: 0,
      jwChunks: [],
    });
  }

  for (const row of input.catalogLessonRows) {
    const semesterId = rowInteger(row.semester_id);
    if (semesterId == null || !targetSemesters.has(semesterId)) continue;
    const sectionJwId = rowInteger(row.id);
    if (sectionJwId == null) {
      throw new Error(
        `Snapshot lesson for semester ${semesterId} has an invalid Section jwId`,
      );
    }
    if (sectionJwIds.has(sectionJwId)) {
      throw new Error(
        `Snapshot contains duplicate Section jwId ${sectionJwId}`,
      );
    }
    sectionJwIds.add(sectionJwId);
    lessonCounts.set(semesterId, (lessonCounts.get(semesterId) ?? 0) + 1);
  }

  for (const row of input.fetchRows) {
    const source = rowString(row.source);
    if (source == null || !SEMESTER_SOURCES.has(source)) continue;
    const context = fetchContext(row);
    const semesterId = contextInteger(source, context, "semester_id");
    if (!targetSemesters.has(semesterId)) continue;
    if (rowBoolean(row.ok) !== true) {
      throw new Error(
        `Snapshot fetch ${source} for semester ${semesterId} failed`,
      );
    }

    const state = fetchState.get(semesterId);
    if (state == null) continue;
    if (source === CATALOG_LESSON_SOURCE) {
      state.catalogLessonFetches += 1;
    } else if (source === CATALOG_EXAM_SOURCE) {
      state.catalogExamFetches += 1;
    } else {
      state.jwChunks.push(contextInteger(source, context, "chunk_index"));
    }
  }

  for (const semesterId of targetSemesters) {
    const state = fetchState.get(semesterId);
    if (state == null) continue;
    if (state.catalogLessonFetches === 0) {
      throw new Error(
        `Snapshot semester ${semesterId} has no successful ${CATALOG_LESSON_SOURCE} fetch`,
      );
    }
    if (semesterId >= examMinSemester && state.catalogExamFetches === 0) {
      throw new Error(
        `Snapshot semester ${semesterId} has no successful ${CATALOG_EXAM_SOURCE} fetch`,
      );
    }

    const expectedChunkCount = Math.ceil(
      (lessonCounts.get(semesterId) ?? 0) / chunkSize,
    );
    const expectedChunkMetadataName = `jw_schedule_expected_chunk_count_${semesterId}`;
    const recordedExpectedChunkCount = optionalNonNegativeIntegerMetadata(
      expectedChunkMetadataName,
      input.metadata[expectedChunkMetadataName],
    );
    if (
      recordedExpectedChunkCount != null &&
      recordedExpectedChunkCount !== expectedChunkCount
    ) {
      throw new Error(
        `Snapshot semester ${semesterId} expected chunk metadata ${recordedExpectedChunkCount} contradicts catalog-derived count ${expectedChunkCount}`,
      );
    }
    const expectedChunks = Array.from(
      { length: expectedChunkCount },
      (_, index) => index,
    );
    const actualChunks = [...state.jwChunks].sort((a, b) => a - b);
    if (
      expectedChunks.length !== actualChunks.length ||
      expectedChunks.some((chunk, index) => chunk !== actualChunks[index])
    ) {
      throw new Error(
        `Snapshot semester ${semesterId} expected JW chunks ${expectedChunks.join(",")} but found ${actualChunks.join(",")}`,
      );
    }
  }

  return {
    sectionJwIds: [...sectionJwIds].sort((left, right) => left - right),
    sectionSemesterJwIds: [...targetSemesters]
      .filter((semesterId) => (lessonCounts.get(semesterId) ?? 0) > 0)
      .sort((left, right) => left - right),
  };
}

export function validateMappedSectionJwIds(
  expectedJwIds: readonly number[],
  mappedJwIds: readonly number[],
): void {
  const expected = new Set(expectedJwIds);
  const mapped = new Set(mappedJwIds);
  const duplicates = mappedJwIds.filter(
    (jwId, index) => mappedJwIds.indexOf(jwId) !== index,
  );
  const missing = [...expected].filter((jwId) => !mapped.has(jwId));
  const unexpected = [...mapped].filter((jwId) => !expected.has(jwId));
  if (
    duplicates.length === 0 &&
    missing.length === 0 &&
    unexpected.length === 0
  )
    return;

  const summarize = (values: readonly number[]) =>
    [...new Set(values)].slice(0, 10).join(",");
  throw new Error(
    [
      "Static Section mapping is incomplete",
      missing.length > 0 ? `missing jwIds=${summarize(missing)}` : null,
      unexpected.length > 0
        ? `unexpected jwIds=${summarize(unexpected)}`
        : null,
      duplicates.length > 0 ? `duplicate jwIds=${summarize(duplicates)}` : null,
    ]
      .filter((part): part is string => part != null)
      .join("; "),
  );
}

export type MissingSnapshotRowsWhere = {
  sectionId: { in: number[] };
  jwId?: { notIn: number[] };
};

export function missingSnapshotRowsWhere(
  sectionIds: number[],
  currentJwIds: number[],
): MissingSnapshotRowsWhere | undefined {
  if (sectionIds.length === 0) return undefined;
  const where: MissingSnapshotRowsWhere = {
    sectionId: { in: [...sectionIds] },
  };
  if (currentJwIds.length > 0) {
    where.jwId = { notIn: [...currentJwIds] };
  }
  return where;
}
