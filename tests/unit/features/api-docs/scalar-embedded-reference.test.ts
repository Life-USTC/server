import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { expect, it } from "vitest";
import { embedScalarReferenceRoot } from "@/features/api-docs/lib/scalar-embedded-reference";

const require = createRequire(import.meta.url);
const component = resolve(
  dirname(require.resolve("@scalar/api-reference")),
  "components/ApiReference.vue_vue_type_script_setup_true_lang.js",
);
const source = readFileSync(component, "utf8");
const main = 'createElementVNode("main", {';
const section = 'createElementVNode("section", {';

it("embeds the actual installed reference as a named section without changing other renderer bytes", () => {
  const transformed = embedScalarReferenceRoot(source, component);
  expect(transformed).not.toBeNull();
  const offset = source.indexOf(main);
  expect(offset).toBeGreaterThan(0);
  expect(source.indexOf(main, offset + 1)).toBe(-1);
  expect(transformed?.code).toBe(
    source.slice(0, offset) + section + source.slice(offset + main.length),
  );
});

it("does not rewrite unrelated main elements", () => {
  expect(
    embedScalarReferenceRoot(source, "/application/reference.js"),
  ).toBeNull();
});

it("keeps the strict vendor boundary across dev query strings and Windows paths", () => {
  expect(embedScalarReferenceRoot(source, `${component}?v=owned`)?.code).toBe(
    embedScalarReferenceRoot(source, component.replaceAll("/", "\\"))?.code,
  );
});

it("refuses unknown or ambiguous vendor markup instead of silently changing other elements", () => {
  expect(() =>
    embedScalarReferenceRoot(
      source.replace('class: "references-rendered"', 'class: "other"'),
      component,
    ),
  ).toThrow("exactly one known Scalar reference root");
  expect(() => embedScalarReferenceRoot(source + source, component)).toThrow(
    "exactly one known Scalar reference root",
  );
});
