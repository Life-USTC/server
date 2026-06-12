import { pick } from "@/lib/mcp/compact-payload";
import { isRecord } from "@/lib/utils";

export function summarizeSectionCard(value: unknown) {
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = pick(value, ["id", "jwId", "code"]);
  if (isRecord(value.course)) {
    out.course = pick(value.course, [
      "jwId",
      "code",
      "nameCn",
      "nameEn",
      "namePrimary",
      "nameSecondary",
    ]);
  }
  if (isRecord(value.semester)) {
    out.semester = pick(value.semester, ["id", "jwId", "code", "nameCn"]);
  }
  if (isRecord(value.campus)) {
    out.campus = pick(value.campus, [
      "id",
      "nameCn",
      "nameEn",
      "namePrimary",
      "nameSecondary",
    ]);
  }
  return out;
}

export function summarizeTeacherCard(value: unknown) {
  if (!isRecord(value)) return value;
  return pick(value, ["id", "code", "nameCn", "nameEn", "namePrimary"]);
}

export function summarizeRoomCard(value: unknown) {
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = pick(value, [
    "id",
    "jwId",
    "namePrimary",
    "nameSecondary",
  ]);
  if (isRecord(value.building)) {
    out.building = pick(value.building, [
      "id",
      "jwId",
      "namePrimary",
      "nameSecondary",
    ]);
  }
  return out;
}
