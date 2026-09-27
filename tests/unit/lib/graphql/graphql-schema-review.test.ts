import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { graphqlSchemaSdl } from "@/lib/graphql/resources";
import { readSpecification } from "../../../../scripts/specifications/yaml";

it("graphql.schema-change-review", { timeout: 30_000 }, async () => {
  const workflow = await readSpecification<{
    on: { pull_request: { types: string[] } };
    jobs: {
      "breaking-changes": {
        steps: Array<{
          name: string;
          if?: string;
          run?: string;
          env?: Record<string, string>;
        }>;
      };
    };
  }>(".github/workflows/graphql-compatibility.yml");
  expect(workflow.on.pull_request.types).toEqual(
    expect.arrayContaining(["labeled", "unlabeled", "synchronize"]),
  );
  const steps = workflow.jobs["breaking-changes"].steps;
  const snapshot = steps.find(
    (step) => step.name === "Verify canonical GraphQL schema snapshot",
  );
  const gate = steps.find(
    (step) => step.name === "Block unapproved breaking changes",
  );
  expect(snapshot?.if).toBeUndefined();
  expect(snapshot?.run).toBe(
    "bunx vitest run tests/unit/lib/graphql/graphql-schema-snapshot.test.ts",
  );
  expect(snapshot?.env).toEqual({
    GRAPHQL_SCHEMA_SKIP_BASE_COMPATIBILITY: "true",
  });
  expect(gate?.if).toBe(
    "$" +
      "{{ !contains(github.event.pull_request.labels.*.name, 'graphql-breaking-approved') }}",
  );
  expect(gate?.env).toEqual({
    GRAPHQL_SCHEMA_BASE_REF: "origin/$" + "{{ github.base_ref }}",
  });
  expect(gate?.run).toContain('-t "does not break the configured base schema"');

  // Execute the actual snapshot/gate test against isolated Git base fixtures.
  const fixture = mkdtempSync(join(tmpdir(), "graphql-review-fixture-"));
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const require = createRequire(import.meta.url);
  const vitestPackage = dirname(require.resolve("vitest/package.json"));
  const cli = join(vitestPackage, "vitest.mjs");
  const testPath = "tests/unit/lib/graphql/graphql-schema-snapshot.test.ts";
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", fixture, ...args], { stdio: "pipe" });
  try {
    execFileSync("git", ["init", "--quiet", fixture], { stdio: "pipe" });
    mkdirSync(join(fixture, "docs/graphql"), { recursive: true });
    const setBase = (sdl: string) => {
      writeFileSync(join(fixture, "docs/graphql/schema.graphql"), sdl);
      git("add", "docs/graphql/schema.graphql");
      git(
        "-c",
        "user.name=GraphQL Fixture",
        "-c",
        "user.email=fixture@example.test",
        "commit",
        "--allow-empty",
        "-qm",
        "Base schema fixture",
      );
    };
    const run = (acknowledged: boolean, config?: string) => {
      const result = spawnSync(
        process.execPath,
        [cli, "run", testPath, ...(config ? ["--config", config] : [])],
        {
          cwd: root,
          env: {
            ...process.env,
            GIT_DIR: join(fixture, ".git"),
            GRAPHQL_SCHEMA_BASE_REF: "HEAD",
            GRAPHQL_SCHEMA_SKIP_BASE_COMPATIBILITY: String(acknowledged),
            SPEC_EVIDENCE_DIR: "",
          },
          encoding: "utf8",
          timeout: 20_000,
        },
      );
      if (result.error) throw result.error;
      return {
        status: result.status,
        output: `${result.stdout}\n${result.stderr}`,
      };
    };
    setBase(graphqlSchemaSdl);
    expect(run(false).status).toBe(0);
    setBase(
      graphqlSchemaSdl.replace(
        "type Query {",
        "type Query {\n  removedBeforeReview: String",
      ),
    );
    const breaking = run(false);
    expect(breaking.status).toBe(1);
    expect(breaking.output).toContain("removedBeforeReview");
    setBase(
      graphqlSchemaSdl.replace("pageSize: Int = 20", "pageSize: Int = 19"),
    );
    const dangerous = run(false);
    expect(dangerous.status).toBe(1);
    expect(dangerous.output).toContain("pageSize");
    expect(run(true).status).toBe(0);

    const setup = join(fixture, "current-schema-drift.ts");
    writeFileSync(
      setup,
      `vi.mock("@/lib/graphql/resources", () => ({ graphqlSchemaSdl: "type Query { intentionalDrift: String }" }));\n`,
    );
    const config = join(fixture, "vitest.config.mts");
    writeFileSync(
      config,
      `import base from ${JSON.stringify(join(root, "vitest.config.ts"))};\nexport default { ...base, test: { ...base.test, setupFiles: [${JSON.stringify(setup)}] } };\n`,
    );
    const drift = run(true, config);
    expect(drift.status).toBe(1);
    expect(drift.output).toContain("graphql.schema-evolution");
    expect(drift.output).toContain("intentionalDrift");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
