import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";

async function verify(name: string) {
  const { stdout } = await promisify(execFile)("bun", [
    fileURLToPath(
      new URL("../fixtures/static-import-contract.ts", import.meta.url),
    ),
    name,
  ]);
  expect(stdout).toContain(`CONTRACT_PASSED:${name}`);
}
it("course.static-section-course-link", () =>
  verify("course.static-section-course-link"));
it("course.static-classification-unsupported", () =>
  verify("course.static-classification-unsupported"));
it("section.source-lifecycle", () => verify("section.source-lifecycle"));
it("section.source-import-atomicity", () =>
  verify("section.source-import-atomicity"));
it("section.source-section-presence", () =>
  verify("section.source-section-presence"));
it("section.retirement-audit", () => verify("section.retirement-audit"));
it("section.retirement-report", () => verify("section.retirement-report"));
