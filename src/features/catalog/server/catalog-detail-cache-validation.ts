type UnknownRecord = Record<string, unknown>;

function isPlainRecord(value: unknown): value is UnknownRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: UnknownRecord, expectedKeys: readonly string[]) {
  const keys = Object.keys(value);
  if (keys.length !== expectedKeys.length) return false;
  const expected = new Set(expectedKeys);
  return keys.every((key) => expected.has(key));
}

function isFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function isSafeInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isNullableString(value: unknown) {
  return value === null || typeof value === "string";
}

function isLocalizedName(value: unknown) {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, ["nameCn", "nameEn", "namePrimary", "nameSecondary"])
  ) {
    return false;
  }

  return (
    typeof value.nameCn === "string" &&
    isNullableString(value.nameEn) &&
    typeof value.namePrimary === "string" &&
    isNullableString(value.nameSecondary)
  );
}

function isNullableLocalizedName(value: unknown) {
  return value === null || isLocalizedName(value);
}

function isSemesterName(value: unknown) {
  return (
    isPlainRecord(value) &&
    hasExactKeys(value, ["nameCn"]) &&
    typeof value.nameCn === "string"
  );
}

function isCoursePageSection(value: unknown) {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, [
      "jwId",
      "code",
      "stdCount",
      "limitCount",
      "semester",
      "campus",
      "teachers",
    ])
  ) {
    return false;
  }

  return (
    isSafeInteger(value.jwId) &&
    typeof value.code === "string" &&
    (value.stdCount === null || isFiniteNumber(value.stdCount)) &&
    (value.limitCount === null || isFiniteNumber(value.limitCount)) &&
    (value.semester === null || isSemesterName(value.semester)) &&
    (value.campus === null || isLocalizedName(value.campus)) &&
    Array.isArray(value.teachers) &&
    value.teachers.every(isLocalizedName)
  );
}

function isTeacherPageSection(value: unknown) {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, ["jwId", "code", "credits", "course", "semester"])
  ) {
    return false;
  }

  return (
    isSafeInteger(value.jwId) &&
    typeof value.code === "string" &&
    (value.credits === null || isFiniteNumber(value.credits)) &&
    isLocalizedName(value.course) &&
    (value.semester === null || isSemesterName(value.semester))
  );
}

/**
 * Validates the exact public course page core shape before it can be served
 * from an anonymous cache. Mutable/user-specific fields are rejected by the
 * exact root and nested key checks.
 */
export function isCoursePageCore(value: unknown) {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, [
      "id",
      "jwId",
      "code",
      "nameCn",
      "nameEn",
      "namePrimary",
      "nameSecondary",
      "educationLevel",
      "category",
      "classType",
      "type",
      "sections",
    ])
  ) {
    return false;
  }

  return (
    isSafeInteger(value.id) &&
    isSafeInteger(value.jwId) &&
    typeof value.code === "string" &&
    typeof value.nameCn === "string" &&
    isNullableString(value.nameEn) &&
    typeof value.namePrimary === "string" &&
    isNullableString(value.nameSecondary) &&
    isNullableLocalizedName(value.educationLevel) &&
    isNullableLocalizedName(value.category) &&
    isNullableLocalizedName(value.classType) &&
    isNullableLocalizedName(value.type) &&
    Array.isArray(value.sections) &&
    value.sections.every(isCoursePageSection)
  );
}

/**
 * Validates the exact public teacher page core shape before it can be served
 * from an anonymous cache. Contact fields are public page fields; viewer,
 * description, subscription, and comment fields are intentionally excluded.
 */
export function isTeacherPageCore(value: unknown) {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, [
      "id",
      "nameCn",
      "nameEn",
      "namePrimary",
      "nameSecondary",
      "email",
      "telephone",
      "mobile",
      "address",
      "department",
      "teacherTitle",
      "sections",
    ])
  ) {
    return false;
  }

  return (
    isSafeInteger(value.id) &&
    typeof value.nameCn === "string" &&
    isNullableString(value.nameEn) &&
    typeof value.namePrimary === "string" &&
    isNullableString(value.nameSecondary) &&
    isNullableString(value.email) &&
    isNullableString(value.telephone) &&
    isNullableString(value.mobile) &&
    isNullableString(value.address) &&
    isNullableLocalizedName(value.department) &&
    isNullableLocalizedName(value.teacherTitle) &&
    Array.isArray(value.sections) &&
    value.sections.every(isTeacherPageSection)
  );
}
