import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Reporter, TestCase } from "vitest/node";

export type McpFixtureFailurePhase =
  | "setup"
  | "teardown"
  | "body"
  | "body-teardown"
  | "runtime"
  | "timeout";

export function errorTree(error: unknown): {
  name: unknown;
  message: unknown;
  errors?: ReturnType<typeof errorTree>[];
} {
  if (!error || typeof error !== "object")
    throw new Error("Expected native error object");
  const value = error as {
    name: unknown;
    message: unknown;
    errors?: unknown[];
  };
  return {
    name: value.name,
    message: value.message,
    ...(Array.isArray(value.errors)
      ? { errors: value.errors.map(errorTree) }
      : {}),
  };
}
export default class McpFixtureFailureReporter implements Reporter {
  onTestCaseResult(test: TestCase) {
    const output = process.env.MCP_FIXTURE_PROBE_OUTPUT;
    if (!output) throw new Error("Missing native MCP fixture output");
    const result = test.result();
    writeFileSync(
      join(output, "native-result.json"),
      JSON.stringify({
        title: test.name,
        at: Date.now(),
        state: result.state,
        errors: (result.errors ?? []).map(errorTree),
      }),
    );
  }
  onTestRunEnd(_modules: readonly unknown[], errors: readonly unknown[]) {
    const output = process.env.MCP_FIXTURE_PROBE_OUTPUT;
    if (!output) throw new Error("Missing native MCP fixture output");
    writeFileSync(
      join(output, "native-run-errors.json"),
      JSON.stringify(errors.map(errorTree)),
    );
  }
}
