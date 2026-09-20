import { describe, expect, it } from "vitest";
import openApi from "../../../../public/openapi.generated.json";

/**
 * Consumer repos (Bot, CLI) generate their clients from this document with
 * oapi-codegen. It resolves every `{name}` segment in a path against that
 * operation's declared `path` parameters and aborts the whole run on a
 * mismatch:
 *
 *   error creating operation definitions: path '/x/{...path}' has 1
 *   positional parameters, but spec has 0 declared
 *
 * A single malformed path therefore breaks client generation in every consumer
 * at once, which is exactly what a SvelteKit rest route (`[...path]`) emitted
 * as `{...path}` did. These assertions keep that class of break out of the
 * published contract.
 */

const paths = openApi.paths as Record<string, Record<string, unknown>>;
const TEMPLATE = /\{([^}]*)\}/g;
const HTTP_METHODS = new Set([
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
]);

function templateNames(routePath: string) {
  return [...routePath.matchAll(TEMPLATE)].map(([, name]) => name);
}

describe("OpenAPI path template contract", () => {
  it("emits no SvelteKit rest or optional parameter syntax", () => {
    const malformed = Object.keys(paths).filter((routePath) =>
      templateNames(routePath).some(
        (name) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name),
      ),
    );

    expect(malformed, malformed.join("\n")).toEqual([]);
  });

  it("declares a path parameter for every templated segment", () => {
    const undeclared: string[] = [];

    for (const [routePath, pathItem] of Object.entries(paths)) {
      const expected = templateNames(routePath);
      if (expected.length === 0) continue;

      for (const [method, operation] of Object.entries(pathItem)) {
        if (!HTTP_METHODS.has(method)) continue;
        const parameters =
          (operation as { parameters?: { name?: string; in?: string }[] })
            .parameters ?? [];
        const declared = new Set(
          parameters.filter((p) => p.in === "path").map((p) => p.name),
        );
        for (const name of expected) {
          if (!declared.has(name)) {
            undeclared.push(`${method} ${routePath} -> {${name}}`);
          }
        }
      }
    }

    expect(undeclared, undeclared.join("\n")).toEqual([]);
  });
});
