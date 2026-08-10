import type { ExamBatchBuild } from "./mappers";

export type ExamBatchOccurrence = {
  semesterCode: number;
  examBatch: ExamBatchBuild;
};

export function selectLatestExamBatches(
  occurrences: readonly ExamBatchOccurrence[],
): ExamBatchBuild[] {
  const byJwId = new Map<number, ExamBatchOccurrence>();
  for (const occurrence of occurrences) {
    const existing = byJwId.get(occurrence.examBatch.jwId);
    if (
      existing != null &&
      existing.semesterCode === occurrence.semesterCode &&
      existing.examBatch.nameCn !== occurrence.examBatch.nameCn
    ) {
      throw new Error(
        `ExamBatch jwId ${occurrence.examBatch.jwId} has conflicting payloads in semester ${occurrence.semesterCode}`,
      );
    }
    if (existing == null || occurrence.semesterCode > existing.semesterCode) {
      byJwId.set(occurrence.examBatch.jwId, occurrence);
    }
  }
  return [...byJwId.values()]
    .sort((a, b) => a.examBatch.jwId - b.examBatch.jwId)
    .map(({ examBatch }) => examBatch);
}
