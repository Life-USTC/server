import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const actionRevision = "033c15c845bef10f148afb0fa781bf1b2a7fe1bf";

async function readRepositoryFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("OpenAPI build and workflow contracts", () => {
  it("generates OpenAPI before every production build", async () => {
    const packageJson = JSON.parse(
      await readRepositoryFile("package.json"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts.build).toBe(
      "bun run openapi:generate && vite build",
    );
    expect(packageJson.scripts["openapi:check"]).toBe(
      "bun run openapi:generate && git diff --exit-code public/openapi.generated.json",
    );
  });

  it("blocks breaking changes unless the explicit approval label is present", async () => {
    const workflow = await readRepositoryFile(
      ".github/workflows/openapi-compatibility.yml",
    );

    expect(workflow.match(new RegExp(actionRevision, "g"))).toHaveLength(2);
    expect(workflow).toContain(
      "base: origin/$" + "{{ github.base_ref }}:public/openapi.generated.json",
    );
    expect(workflow).toContain("revision: HEAD:public/openapi.generated.json");
    expect(workflow).toContain("fail-on: WARN");
    expect(workflow.match(/review: false/g)).toHaveLength(2);
    expect(workflow).toContain("'api-breaking-approved'");
    expect(workflow).toContain(
      "types: [opened, synchronize, reopened, labeled, unlabeled]",
    );
  });

  it("dispatches the immutable server revision without failing on a missing token", async () => {
    const workflow = await readRepositoryFile(
      ".github/workflows/openapi-consumer-sync.yml",
    );

    expect(workflow).toContain("OPENAPI_SYNC_TOKEN");
    expect(workflow).toContain("event_type=openapi-updated");
    expect(workflow).toContain("client_payload[server_sha]=$" + "{GITHUB_SHA}");
    expect(workflow).toContain("Life-USTC/bot Life-USTC/cli");
    expect(workflow).toMatch(
      /if \[\[ -z "\$\{GH_TOKEN:-\}" \]\];[\s\S]*exit 0/,
    );
  });
});
