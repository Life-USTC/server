import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function importSource() {
  return readFile(
    new URL("../../src/static-loader/import.ts", import.meta.url),
    "utf8",
  );
}

function stageIndex(source: string, stage: string) {
  const index = source.indexOf(`"${stage}",`);
  expect(index, `missing static import stage ${stage}`).toBeGreaterThan(-1);
  return index;
}

describe("static Section lifecycle orchestration", () => {
  it("acquires lifecycle locks only after the long import stages and counts", async () => {
    const source = await importSource();
    const lifecycleIndex = stageIndex(
      source,
      "reconcileSectionSourceLifecycle",
    );

    for (const stage of [
      "upsertScheduleGroups",
      "writeSectionTeachers",
      "writeTeacherAssignments",
      "writeAdminClassSections",
      "writeSchedules",
      "reconcileCatalogTeacherFallbacks",
      "upsertExams",
      "writeExamRooms",
      "reconcileRemovedSnapshotRows",
      "mergeLegacyCourseDuplicates",
      "countDatabaseRecords",
    ]) {
      expect(lifecycleIndex).toBeGreaterThan(stageIndex(source, stage));
    }
    const importStateIndex = stageIndex(source, "recordStaticImportState");
    expect(importStateIndex).toBeGreaterThan(lifecycleIndex);
    expect(source.indexOf("logStep(", lifecycleIndex)).toBe(
      source.lastIndexOf("logStep(", importStateIndex),
    );
  });
});
