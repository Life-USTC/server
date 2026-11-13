import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type AST, parse } from "svelte/compiler";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const sourceRoots = ["src"];
const hoverLiteralPattern =
  /data-sveltekit-preload-data\s*=\s*(?:"hover"|'hover'|\{\s*["']hover["']\s*\})/;
const hoverBooleanAttributePattern =
  /data-sveltekit-preload-data(?=[\s/>])(?!\s*=)/;

function hasHoverDataPreload(source: string): boolean {
  return (
    hoverLiteralPattern.test(source) ||
    hoverBooleanAttributePattern.test(source)
  );
}

type ElementAttributes = {
  element: string;
  attributes: Map<string, string | boolean>;
  localRestore: boolean;
};

function isLocalRestoreValue(value: unknown): boolean {
  const fragment = Array.isArray(value)
    ? value.length === 1
      ? value[0]
      : undefined
    : value;
  if (
    !fragment ||
    typeof fragment !== "object" ||
    !("type" in fragment) ||
    fragment.type !== "ExpressionTag"
  )
    return false;
  const { expression } = fragment as AST.ExpressionTag;
  return (
    expression?.type === "ConditionalExpression" &&
    expression.test?.type === "CallExpression" &&
    expression.test.callee?.type === "Identifier" &&
    expression.test.callee.name === "restoresCurrent" &&
    expression.test.arguments?.length === 1 &&
    expression.test.arguments[0]?.type === "Identifier" &&
    expression.test.arguments[0].name === "link" &&
    expression.consequent?.type === "Literal" &&
    expression.consequent.value === "false" &&
    expression.alternate?.type === "Identifier" &&
    expression.alternate.name === "undefined"
  );
}

function elementAttributes(source: string, filename: string) {
  const elements: ElementAttributes[] = [];
  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if (node.type === "RegularElement" || node.type === "Component") {
      const attributes = new Map<string, string | boolean>();
      const sourceAttributes = node.attributes as Array<
        Record<string, unknown>
      >;
      // Only this real local-restoration anchor opts out of both inherited preloads.
      // Arbitrary dynamic preload expressions remain forbidden throughout src.
      const localRestore =
        path.resolve(filename) ===
          path.join(repoRoot, "src/lib/components/shell/AppSidebar.svelte") &&
        node.name === "a" &&
        ["data-sveltekit-preload-data", "data-sveltekit-preload-code"].every(
          (name) => {
            const matches = sourceAttributes.filter(
              (attribute) =>
                attribute.type === "Attribute" && attribute.name === name,
            );
            return (
              matches.length === 1 && isLocalRestoreValue(matches[0].value)
            );
          },
        );
      for (const attribute of sourceAttributes) {
        if (
          attribute.type !== "Attribute" ||
          typeof attribute.name !== "string" ||
          !attribute.name.startsWith("data-sveltekit-preload-")
        )
          continue;
        if (attribute.value === true) attributes.set(attribute.name, true);
        else {
          // Modern Svelte represents an unquoted expression as one ExpressionTag,
          // while quoted fragments use an array. Only the exact paired exception
          // may use either dynamic representation before the static-only guard.
          if (localRestore && isLocalRestoreValue(attribute.value)) {
            attributes.set(attribute.name, "false");
            continue;
          }
          expect(
            Array.isArray(attribute.value),
            `${filename}:${attribute.name}`,
          ).toBe(true);
          const fragments = attribute.value as Array<Record<string, unknown>>;
          const text = fragments
            .map((fragment) => {
              if (fragment.type === "Text") return fragment.data;
              const expression = fragment.expression as
                | Record<string, unknown>
                | undefined;
              expect(expression?.type, `${filename}:${attribute.name}`).toBe(
                "Literal",
              );
              return expression?.value;
            })
            .join("");
          attributes.set(attribute.name, text);
        }
      }
      elements.push({ element: String(node.name), attributes, localRestore });
    }
    Object.values(node).forEach(visit);
  }
  // Raw HTML fragments can contain several script tags; they are markup,
  // not the single top-level component script understood by the Svelte parser.
  const markup = filename.endsWith(".html") ? `<div>${source}</div>` : source;
  visit(parse(markup, { modern: true, filename }));
  return elements;
}

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory())
      files.push(...(await collectSourceFiles(fullPath)));
    else if (entry.name.endsWith(".svelte") || entry.name.endsWith(".html"))
      files.push(fullPath);
  }
  return files;
}

describe("navigation preload policy", () => {
  it("allows only the Sidebar local-restore anchor's paired conditional opt-out", () => {
    const filename = path.join(
      repoRoot,
      "src/lib/components/shell/AppSidebar.svelte",
    );
    const source =
      '<a href="/" data-sveltekit-preload-data={restoresCurrent(link) ? "false" : undefined} data-sveltekit-preload-code={restoresCurrent(link) ? "false" : undefined}>Workspace</a>';
    const [anchor] = elementAttributes(source, filename);
    expect(anchor.localRestore).toBe(true);
    expect(Object.fromEntries(anchor.attributes)).toEqual({
      "data-sveltekit-preload-data": "false",
      "data-sveltekit-preload-code": "false",
    });
    for (const invalid of [
      source.replace(
        ' data-sveltekit-preload-code={restoresCurrent(link) ? "false" : undefined}',
        "",
      ),
      source.replaceAll("restoresCurrent(link)", "other(link)"),
      source.replaceAll("restoresCurrent(link)", "restoresCurrent(other)"),
      source.replaceAll('"false" : undefined', '"hover" : undefined'),
      source.replaceAll("<a ", "<div ").replace("</a>", "</div>"),
    ])
      expect(() => elementAttributes(invalid, filename)).toThrow();
    expect(() => elementAttributes(source, "src/Other.svelte")).toThrow();
  });

  it("retains navigation attributes in raw HTML with multiple scripts", () => {
    const elements = elementAttributes(
      '<script src="/first.js"></script><script>window.ready = true;</script><a href="/catalog" data-sveltekit-preload-data="hover">Catalog</a>',
      "fragment.html",
    );
    const links = elements.filter(({ element }) => element === "a");
    expect(links).toHaveLength(1);
    expect(links[0].attributes.get("data-sveltekit-preload-data")).toBe(
      "hover",
    );
  });

  it("rendering-and-cache.contributor-notes-4", async () => {
    const source = await readFile(path.join(repoRoot, "src/app.html"), "utf8");
    const body = elementAttributes(source, "src/app.html").filter(
      (element) => element.element === "body",
    );
    expect(body).toHaveLength(1);
    expect(body[0].attributes.get("data-sveltekit-preload-code")).toBe("hover");
    expect(body[0].attributes.get("data-sveltekit-preload-data")).toBe("tap");
    for (const file of await collectSourceFiles(path.join(repoRoot, "src"))) {
      const elements = elementAttributes(await readFile(file, "utf8"), file);
      for (const element of elements) {
        const value = element.attributes.get("data-sveltekit-preload-data");
        if (value !== undefined)
          expect(
            element.localRestore ? ["false"] : ["tap", "off"],
            `${path.relative(repoRoot, file)}:${element.element}`,
          ).toContain(value);
      }
    }
  });

  it("does not opt links back into hover data preload", async () => {
    const violations: string[] = [];

    for (const root of sourceRoots) {
      const files = await collectSourceFiles(path.join(repoRoot, root));
      for (const file of files) {
        const source = await readFile(file, "utf8");
        if (!hasHoverDataPreload(source)) continue;
        violations.push(path.relative(repoRoot, file));
      }
    }

    expect(violations).toEqual([]);
  });
});
