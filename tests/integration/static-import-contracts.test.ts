import { staticImportProcessTest as it } from "../shared/static-import-process-fixture";

for (const name of [
  "course.official-profile-import",
  "course.static-section-course-link",
  "course.static-classification-unsupported",
  "section.source-import-atomicity",
  "section.source-section-presence",
  "section.retirement-audit",
  "section.retirement-report",
]) {
  it(
    name,
    { tags: ["@StaticImport/Runtime"] },
    async ({ staticImportProcess }) => staticImportProcess.verify(name),
  );
}
