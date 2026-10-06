import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const actionRevision = "5e81b5c380accc6b523f9d32a637ca630e33620b";

async function readRepositoryFile(path: string) {
  return readFile(new URL(`../../../../${path}`, import.meta.url), "utf8");
}

describe("OpenAPI build and workflow contracts", () => {
  it("openapi.build-generation", async () => {
    const packageJson = JSON.parse(
      await readRepositoryFile("package.json"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts.build).toBe(
      "bun run app:prepare && bun run openapi:generate && vite build",
    );
    expect(packageJson.scripts["openapi:check"]).toBe(
      "bun run openapi:generate && git diff --exit-code public/openapi.generated.json",
    );
  });

  it("blocks breaking changes unless the explicit approval label is present", async () => {
    const workflow = await readRepositoryFile(
      ".github/workflows/openapi-compatibility.yml",
    );

    expect(workflow.match(new RegExp(actionRevision, "g"))).toHaveLength(1);
    expect(workflow).toContain(
      "base: origin/$" + "{{ github.base_ref }}:public/openapi.generated.json",
    );
    expect(workflow).toContain("revision: HEAD:public/openapi.generated.json");
    expect(workflow).toContain(
      "fail-on: $" +
        "{{ !contains(github.event.pull_request.labels.*.name, 'api-breaking-approved') && 'WARN' || '' }}",
    );
    expect(workflow.match(/review: false/g)).toHaveLength(1);
    expect(workflow).toContain("'api-breaking-approved'");
    expect(workflow).toContain(
      "types: [opened, synchronize, reopened, labeled, unlabeled]",
    );
  });

  it("keeps the GraphQL snapshot exact while allowing labeled base breaks", async () => {
    const compatibilityWorkflow = await readRepositoryFile(
      ".github/workflows/graphql-compatibility.yml",
    );
    const ciWorkflow = await readRepositoryFile(".github/workflows/ci.yml");

    expect(compatibilityWorkflow).toContain("'graphql-breaking-approved'");
    expect(compatibilityWorkflow).toContain(
      "types: [opened, synchronize, reopened, labeled, unlabeled]",
    );
    expect(compatibilityWorkflow).toContain(
      "GRAPHQL_SCHEMA_SKIP_BASE_COMPATIBILITY: $" +
        "{{ contains(github.event.pull_request.labels.*.name, 'graphql-breaking-approved') }}",
    );
    expect(compatibilityWorkflow).toContain(
      'GRAPHQL_SCHEMA_BASE_REF: "origin/$' + '{{ github.base_ref }}"',
    );
    expect(
      compatibilityWorkflow.match(
        /bunx vitest run tests\/unit\/lib\/graphql\/graphql-schema-snapshot.test.ts/g,
      ),
    ).toHaveLength(1);
    expect(ciWorkflow).toMatch(
      /test-unit:[\s\S]*GRAPHQL_SCHEMA_SKIP_BASE_COMPATIBILITY: "true"[\s\S]*bunx vitest run --coverage/,
    );
    expect(ciWorkflow).not.toContain("PR_TITLE:");
  });
});
