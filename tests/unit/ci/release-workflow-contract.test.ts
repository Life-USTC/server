import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("release workflow contract", () => {
  it("serializes releases and gates the current main tip on full CI", async () => {
    const workflow = await readFile(
      new URL("../../../.github/workflows/release.yml", import.meta.url),
      "utf8",
    );

    expect(workflow).toMatch(
      /concurrency:\n {2}group: release-main\n {2}cancel-in-progress: false/,
    );
    expect(workflow).toContain("actions: read");
    expect(workflow).toContain("ref: main");
    expect(workflow).not.toContain(
      "ref: ${{ github.event.workflow_run.head_sha " + "}}",
    );
    expect(workflow).toContain(
      "actions/workflows/ci.yml/runs?branch=main&event=push&head_sha=$" +
        "{CURRENT_SHA}&status=completed",
    );
    expect(workflow).toContain(
      '.head_branch == "main" and .event == "push" and .status == "completed" and .conclusion == "success"',
    );
    expect(workflow).toMatch(
      /name: Run semantic-release\n\s+if: steps\.ci-gate\.outputs\.verified == 'true'/,
    );
    expect(workflow).toContain("git fetch --prune --tags origin main");
  });
});
