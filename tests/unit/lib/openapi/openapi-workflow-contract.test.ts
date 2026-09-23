import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const actionRevision = "9c0494cfee8b8fcc9fb383ed2d5d3fbdae169b93";

async function readRepositoryFile(path: string) {
  return readFile(new URL(`../../../../${path}`, import.meta.url), "utf8");
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
    const bunWorkflow = await readRepositoryFile(
      ".github/workflows/bun-job.yml",
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
    expect(bunWorkflow).toMatch(
      /name: Verify canonical GraphQL schema snapshot[\s\S]*GRAPHQL_SCHEMA_SKIP_BASE_COMPATIBILITY: "true"/,
    );
    expect(bunWorkflow).toContain(
      'echo "GRAPHQL_SCHEMA_SKIP_BASE_COMPATIBILITY=true"',
    );
    expect(bunWorkflow).not.toContain("PR_TITLE:");
  });
});
