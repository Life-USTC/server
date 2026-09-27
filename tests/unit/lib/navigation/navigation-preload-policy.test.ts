import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "svelte/compiler";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

type ElementAttributes = {
  element: string;
  attributes: Map<string, string | boolean>;
};

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
      for (const attribute of node.attributes as Array<
        Record<string, unknown>
      >) {
        if (
          attribute.type !== "Attribute" ||
          typeof attribute.name !== "string" ||
          !attribute.name.startsWith("data-sveltekit-preload-")
        )
          continue;
        if (attribute.value === true) attributes.set(attribute.name, true);
        else {
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
      elements.push({ element: String(node.name), attributes });
    }
    Object.values(node).forEach(visit);
  }
  visit(parse(source, { modern: true, filename }));
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
            ["tap", "off"],
            `${path.relative(repoRoot, file)}:${element.element}`,
          ).toContain(value);
      }
    }
  });

  it("disables SvelteKit data preload on detail section nav links", async () => {
    const filename = "src/lib/components/DetailSectionNav.svelte";
    const elements = elementAttributes(
      await readFile(path.join(repoRoot, filename), "utf8"),
      filename,
    );
    const preloadOverrides = elements.filter((element) =>
      element.attributes.has("data-sveltekit-preload-data"),
    );
    expect(preloadOverrides).toHaveLength(1);
    expect(preloadOverrides[0].element).toBe("a");
    expect(
      preloadOverrides[0].attributes.get("data-sveltekit-preload-data"),
    ).toBe("off");
  });
});
