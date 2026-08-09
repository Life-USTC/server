import type { AdminClassBuild } from "./identity-types";

export type AdminClassOccurrence = {
  semesterCode: number;
  adminClass: AdminClassBuild;
};

export function selectLatestAdminClasses(
  occurrences: readonly AdminClassOccurrence[],
): AdminClassBuild[] {
  const byJwId = new Map<number, AdminClassOccurrence>();
  const jwIdByCode = new Map<string, number>();
  for (const occurrence of occurrences) {
    const code = occurrence.adminClass.code;
    if (code) {
      const codeOwner = jwIdByCode.get(code);
      if (codeOwner != null && codeOwner !== occurrence.adminClass.jwId) {
        throw new Error(
          `AdminClass code ${code} maps to multiple jwIds: ${codeOwner}, ${occurrence.adminClass.jwId}`,
        );
      }
      jwIdByCode.set(code, occurrence.adminClass.jwId);
    }
    const existing = byJwId.get(occurrence.adminClass.jwId);
    if (
      existing != null &&
      existing.adminClass.code != null &&
      occurrence.adminClass.code != null &&
      existing.adminClass.code !== occurrence.adminClass.code
    ) {
      throw new Error(
        `AdminClass jwId ${occurrence.adminClass.jwId} maps to conflicting codes: ${existing.adminClass.code} vs ${occurrence.adminClass.code}`,
      );
    }
    const incomingKey = JSON.stringify(occurrence.adminClass);
    const existingKey =
      existing == null ? "" : JSON.stringify(existing.adminClass);
    if (
      existing == null ||
      occurrence.semesterCode > existing.semesterCode ||
      (occurrence.semesterCode === existing.semesterCode &&
        incomingKey > existingKey)
    ) {
      byJwId.set(occurrence.adminClass.jwId, occurrence);
    }
  }
  return [...byJwId.values()]
    .sort((a, b) => a.adminClass.jwId - b.adminClass.jwId)
    .map(({ adminClass }) => adminClass);
}
