import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, reportUnexpectedError, walkFiles } from "./common";

function checkE2eConventions() {
  type Violation = {
    file: string;
    rule: string;
    line: number;
  };

  const e2eRoot = join(repoRoot, "tests/e2e");
  const prismaFixtureRoot = join(e2eRoot, "utils/e2e-db");
  const violations: Violation[] = [];

  function addViolation(file: string, rule: string, line: number) {
    violations.push({
      file: file.replace(`${repoRoot}/`, ""),
      rule,
      line,
    });
  }

  for (const file of walkFiles(e2eRoot)) {
    if (!/\.(ts|tsx)$/.test(file)) {
      continue;
    }

    const source = readFileSync(file, "utf8");
    const lines = source.split("\n");

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (line.includes("waitForTimeout(")) {
        addViolation(file, "Do not use waitForTimeout()", lineNumber);
      }
      if (line.includes("test.skip(") || line.includes(".skip(")) {
        addViolation(file, "Do not commit skipped e2e tests", lineNumber);
      }
      if (
        line.includes('from "@/lib/db/prisma"') &&
        !file.startsWith(prismaFixtureRoot)
      ) {
        addViolation(
          file,
          "Do not import Prisma directly in Playwright tests; use tests/e2e/utils/e2e-db helpers",
          lineNumber,
        );
      }
    });
  }

  if (violations.length > 0) {
    console.error("E2E convention check failed:\n");
    for (const violation of violations) {
      console.error(`${violation.file}:${violation.line} ${violation.rule}`);
    }
    process.exit(1);
  }
}

try {
  checkE2eConventions();
} catch (error: unknown) {
  reportUnexpectedError(error);
}
