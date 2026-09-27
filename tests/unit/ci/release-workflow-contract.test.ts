import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("release workflow contract", () => {
  it("publishes GitHub releases without plugins that prepare repository changes", async () => {
    const config: { plugins: (string | [string, unknown])[] } = JSON.parse(
      await readFile(
        new URL("../../../.releaserc.json", import.meta.url),
        "utf8",
      ),
    );
    const pluginNames = config.plugins.map((plugin) =>
      typeof plugin === "string" ? plugin : plugin[0],
    );

    expect(pluginNames).toContain("@semantic-release/github");
    for (const pluginName of pluginNames) {
      const plugin = await import(pluginName);
      // Prepare hooks can write release files or commit them onto protected main.
      expect(
        plugin.prepare,
        `${pluginName} must not prepare repository changes`,
      ).toBeUndefined();
      if (pluginName === "@semantic-release/github") {
        expect(plugin.publish).toBeTypeOf("function");
      }
    }
  });

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
