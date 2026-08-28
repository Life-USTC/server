import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const actionRevision = "2649ebe137aeb72a95707671204e829f86e091fc";

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

  it("keeps the GraphQL snapshot exact while allowing labeled base breaks", async () => {
    const compatibilityWorkflow = await readRepositoryFile(
      ".github/workflows/graphql-compatibility.yml",
    );
    const dbBackedWorkflow = await readRepositoryFile(
      ".github/workflows/db-backed-bun-job.yml",
    );

    expect(compatibilityWorkflow).toContain("'graphql-breaking-approved'");
    expect(compatibilityWorkflow).toContain(
      "types: [opened, synchronize, reopened, labeled, unlabeled]",
    );
    expect(compatibilityWorkflow).toMatch(
      /name: Verify canonical GraphQL schema snapshot[\s\S]*GRAPHQL_SCHEMA_SKIP_BASE_COMPATIBILITY: "true"/,
    );
    expect(compatibilityWorkflow).toContain(
      'GRAPHQL_SCHEMA_BASE_REF: "origin/$' + '{{ github.base_ref }}"',
    );
    expect(compatibilityWorkflow).toContain(
      '-t "does not break the configured base schema"',
    );
    expect(dbBackedWorkflow).toMatch(
      /name: Verify canonical GraphQL schema snapshot[\s\S]*GRAPHQL_SCHEMA_SKIP_BASE_COMPATIBILITY: "true"/,
    );
    expect(dbBackedWorkflow).toContain(
      'echo "GRAPHQL_SCHEMA_SKIP_BASE_COMPATIBILITY=true"',
    );
    expect(dbBackedWorkflow).not.toContain("PR_TITLE:");
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
