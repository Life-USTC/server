import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { parse } from "yaml";

it("keeps the CI RLS preflight function allowlist equal to the database contract", async () => {
  const [workflowSource, contractSource] = await Promise.all([
    readFile(
      new URL("../../../.github/workflows/ci.yml", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../../integration/rls-database-contract.test.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  const workflow = parse(workflowSource) as {
    jobs: { "test-rls": { steps: Array<{ name?: string; run?: string }> } };
  };
  const phase = workflow.jobs["test-rls"].steps.find(
    (step) => step.name === "Verify runtime roles",
  )?.run;
  expect(phase).toBeDefined();
  const preflight = [
    ...(phase ?? "").matchAll(
      /^\s*expected_function_privileges\+?=',?([^']+)'$/gm,
    ),
  ].map((match) => match[1]);
  const contract = contractSource.match(
    /const expectedRuntimeFunctionPrivileges = \[([\s\S]*?)\] as const;/,
  )?.[1];
  expect(contract).toBeDefined();
  const privileges = [...(contract ?? "").matchAll(/"([^"]+)"/g)].map(
    (match) => match[1],
  );
  expect(privileges.length).toBeGreaterThan(0);
  expect(preflight).toEqual(privileges);
  expect(phase).toContain(
    '--set=expected_function_privileges="$expected_function_privileges"',
  );
  expect(phase).toContain("--file=prisma/roles/verify-app-runtime.sql");
});
