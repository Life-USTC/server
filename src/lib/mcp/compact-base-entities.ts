import { isRecord } from "@/lib/utils";
import { pick, transferScalarKeys } from "./compact-helpers";

export function compactUser(value: unknown) {
  if (!isRecord(value)) return value;
  return pick(value, ["id", "name", "username", "image"]);
}

export function compactDepartment(value: unknown) {
  if (!isRecord(value)) return value;
  return pick(value, [
    "id",
    "nameCn",
    "nameEn",
    "namePrimary",
    "nameSecondary",
  ]);
}

export function compactTeacherTitle(value: unknown) {
  if (!isRecord(value)) return value;
  return pick(value, [
    "id",
    "nameCn",
    "nameEn",
    "namePrimary",
    "nameSecondary",
  ]);
}

export function compactCourse(value: unknown) {
  if (!isRecord(value)) return value;
  return pick(value, [
    "id",
    "jwId",
    "code",
    "nameCn",
    "nameEn",
    "namePrimary",
    "nameSecondary",
    "credit",
    "hours",
  ]);
}

export function compactSemester(value: unknown) {
  if (!isRecord(value)) return value;
  return pick(value, [
    "id",
    "jwId",
    "code",
    "nameCn",
    "namePrimary",
    "startDate",
    "endDate",
  ]);
}

export function compactCampus(
  value: unknown,
  options?: { includeCoordinates?: boolean },
) {
  if (!isRecord(value)) return value;
  const base = pick(value, [
    "id",
    "nameCn",
    "nameEn",
    "namePrimary",
    "nameSecondary",
  ]);
  if (options?.includeCoordinates) {
    return { ...base, ...transferScalarKeys(value, ["latitude", "longitude"]) };
  }
  return base;
}
