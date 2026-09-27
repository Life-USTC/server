import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "svelte/compiler";
import { expect, it } from "vitest";

type Node = {
  type?: string;
  name?: string;
  value?: unknown;
  source?: { value?: string };
  attributes?: Node[];
  [key: string]: unknown;
};
function visit(node: unknown, callback: (node: Node) => void): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) visit(child, callback);
    return;
  }
  const record = node as Node;
  if (typeof record.type === "string") callback(record);
  for (const value of Object.values(record)) visit(value, callback);
}

it("ui.basic-info-card-2", async () => {
  const roots = [
    "src/features/catalog/components/CourseDetailBasicInfo.svelte",
    "src/features/catalog/components/TeacherDetailBasicInfo.svelte",
    "src/features/section-detail/components/SectionBasicInfoCard.svelte",
  ];
  for (const root of roots) {
    const pending = [root];
    const seen = new Set<string>();
    const tags = new Set<string>();
    while (pending.length) {
      const filename = pending.pop()!;
      if (seen.has(filename)) continue;
      seen.add(filename);
      const ast = parse(await readFile(filename, "utf8"), {
        modern: true,
        filename,
      });
      visit(ast, (node) => {
        if (
          node.type === "ImportDeclaration" ||
          node.type === "ImportExpression"
        ) {
          const source = node.source?.value;
          if (!source) return;
          expect(source, filename).not.toMatch(
            /(?:comments|homeworks|workspace)\//,
          );
          if (source.startsWith(".") && source.endsWith(".svelte"))
            pending.push(path.posix.join(path.posix.dirname(filename), source));
        }
        if (node.type === "RegularElement" || node.type === "Component") {
          if (node.name) tags.add(node.name);
          expect(node.name, filename).not.toMatch(
            /^(?:form|input|textarea|select|CommentsPanel|HomeworkDetailDialog)$/,
          );
          for (const attribute of node.attributes ?? []) {
            expect(attribute.type, filename).not.toBe("OnDirective");
            expect(attribute.name, filename).not.toMatch(
              /^on(?:click|submit|change|input)$/,
            );
          }
        }
      });
    }
    expect(tags.has("dl"), root).toBe(true);
    expect(tags.has("dt"), root).toBe(true);
    expect(tags.has("dd"), root).toBe(true);
  }
});
