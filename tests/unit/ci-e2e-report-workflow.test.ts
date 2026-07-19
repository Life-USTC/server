import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function publishJobSource() {
  const workflow = await readFile(
    new URL("../../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );
  const marker = "  publish-e2e-html-report:";
  const jobStart = workflow.indexOf(marker);

  expect(jobStart).toBeGreaterThan(-1);

  const remainingWorkflow = workflow.slice(jobStart + marker.length);
  const nextJobOffset = remainingWorkflow.search(/\n {2}[a-z0-9-]+:\n/);

  return workflow.slice(
    jobStart,
    nextJobOffset === -1 ? undefined : jobStart + marker.length + nextJobOffset,
  );
}

describe("E2E report publication workflow", () => {
  it("serializes every pending publisher without making reports required", async () => {
    const job = await publishJobSource();

    expect(job).toContain("continue-on-error: true");
    expect(job).toMatch(
      /concurrency:\n\s+group: publish-e2e-html-report\n\s+queue: max\n\s+cancel-in-progress: false/,
    );
    expect(job).toMatch(/reports\/\$\{RUN_ID\}/);
  });
});
