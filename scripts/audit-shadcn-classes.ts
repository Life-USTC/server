import { parse, type AST } from "svelte/compiler";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";

const UI_DIR = "src/lib/components/ui";
const OUTPUT = "docs/superpowers/artifacts/shadcn-class-audit.json";

type ComponentImport = {
  component: string;
  importPath: string;
};

type AuditEntry = {
  file: string;
  line: number;
  column: number;
  componentImport: string;
  tag: string;
  component: string;
  subComponent: string | null;
  classValue: string | null;
  styleValue: string | null;
  isConditional: boolean;
};

async function listUiComponents(dir: string): Promise<Set<string>> {
  const names = new Set<string>();
  for await (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) names.add(entry.name);
  }
  return names;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractUiImports(
  source: string,
  components: Set<string>,
): Map<string, ComponentImport> {
  const tagMap = new Map<string, ComponentImport>();
  const componentPattern = [...components].map(escapeRegExp).join("|");

  // Matches:
  // import { Button } from "$lib/components/ui/button/index.js";
  // import { Button as Btn } from "$lib/components/ui/button/index.js";
  // import * as Card from "$lib/components/ui/card/index.js";
  const importRegex = new RegExp(
    `import\\s+(?:(\\*\\s+as\\s+([A-Za-z_$][A-Za-z0-9_$]*))|(\\{[^}]*\\}))\\s+from\\s+["'](\\$lib/components/ui/(${componentPattern})(?:/[^"']*)?)["']`,
    "g",
  );

  for (
    let match = importRegex.exec(source);
    match !== null;
    match = importRegex.exec(source)
  ) {
    const importPath = match[4];
    const component = match[5];

    if (match[2]) {
      // Namespace import: * as Card
      tagMap.set(match[2], { component, importPath });
    } else if (match[3]) {
      // Named imports: { Button, Badge as B }
      const namedImports = match[3].slice(1, -1);
      const specifiers = namedImports
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const spec of specifiers) {
        const parts = spec.split(/\s+as\s+/).map((s) => s.trim());
        const localName = parts.length === 2 ? parts[1] : parts[0];
        tagMap.set(localName, { component, importPath });
      }
    }
  }

  return tagMap;
}

function findTagMatch(
  name: string,
  tagMap: Map<string, ComponentImport>,
): ComponentImport | null {
  const exactMatch = tagMap.get(name);
  if (exactMatch) return exactMatch;

  const dotIndex = name.indexOf(".");
  if (dotIndex > 0) {
    const namespace = name.slice(0, dotIndex);
    const namespaceMatch = tagMap.get(namespace);
    if (namespaceMatch) return namespaceMatch;
  }
  return null;
}

function parseComponentName(
  name: string,
  componentDir: string,
): { component: string; subComponent: string | null } {
  const dotIndex = name.indexOf(".");
  const subComponent = dotIndex > 0 ? name.slice(dotIndex + 1) : null;
  return { component: componentDir, subComponent };
}

function extractAttributeValue(attr: AST.Attribute, source: string): string {
  const raw = source.slice(attr.start, attr.end);
  const eqIndex = raw.indexOf("=");
  return eqIndex >= 0 ? raw.slice(eqIndex + 1).trim() : raw;
}

function expressionIsConditional(expression: AST.Expression): boolean {
  if (!expression) return false;
  switch (expression.type) {
    case "ConditionalExpression":
    case "LogicalExpression":
      return true;
    case "CallExpression":
      return expression.arguments.some(
        (arg) =>
          arg &&
          typeof arg === "object" &&
          "type" in arg &&
          expressionIsConditional(arg as AST.Expression),
      );
    default:
      return false;
  }
}

function attributeIsConditional(attr: AST.Attribute): boolean {
  if (attr.value && typeof attr.value === "object") {
    if (Array.isArray(attr.value)) {
      return attr.value.some(
        (v) =>
          v.type === "ExpressionTag" && expressionIsConditional(v.expression),
      );
    }
    if (attr.value.type === "ExpressionTag") {
      return expressionIsConditional(attr.value.expression);
    }
  }
  return false;
}

function walkAst(node: unknown, visitor: (node: AST.Node) => void): void {
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const child of node) walkAst(child, visitor);
    return;
  }

  if ("type" in node) {
    visitor(node as AST.Node);
  }

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "type" || key === "loc" || key === "name_loc") continue;
    walkAst(value, visitor);
  }
}

function auditSvelteFile(
  file: string,
  source: string,
  components: Set<string>,
): AuditEntry[] {
  const tagMap = extractUiImports(source, components);
  if (tagMap.size === 0) return [];

  let ast: AST.Root;
  try {
    ast = parse(source, { modern: true });
  } catch (error) {
    console.warn(`Failed to parse ${file}:`, error);
    return [];
  }

  const results: AuditEntry[] = [];

  walkAst(ast.fragment, (node) => {
    if (node.type !== "Component" || typeof node.name !== "string") return;

    const match = findTagMatch(node.name, tagMap);
    if (!match) return;

    const attributes = node.attributes as AST.Attribute[];
    const classAttr = attributes.find(
      (a) => a.type === "Attribute" && a.name === "class",
    );
    const styleAttr = attributes.find(
      (a) => a.type === "Attribute" && a.name === "style",
    );

    if (!classAttr && !styleAttr) return;

    const classValue = classAttr
      ? extractAttributeValue(classAttr, source)
      : null;
    const styleValue = styleAttr
      ? extractAttributeValue(styleAttr, source)
      : null;
    const isConditional =
      (classAttr && attributeIsConditional(classAttr)) ||
      (styleAttr && attributeIsConditional(styleAttr));

    const { component, subComponent } = parseComponentName(
      node.name,
      match.component,
    );

    results.push({
      file,
      line: node.name_loc.start.line,
      column: node.name_loc.start.column,
      componentImport: match.importPath,
      tag: `<${node.name}`,
      component,
      subComponent,
      classValue,
      styleValue,
      isConditional,
    });
  });

  return results;
}

function auditTsJsFile(
  file: string,
  source: string,
  components: Set<string>,
): AuditEntry[] {
  const tagMap = extractUiImports(source, components);
  if (tagMap.size === 0) return [];

  const results: AuditEntry[] = [];
  const tagNames = [...tagMap.keys()];
  const componentPattern = tagNames.map(escapeRegExp).join("|");
  const tagRegex = new RegExp(
    `<(${componentPattern})(?:\\.([A-Za-z0-9_$]+))?\\b`,
    "g",
  );

  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const match of line.matchAll(tagRegex)) {
      const fullName = match[2] ? `${match[1]}.${match[2]}` : match[1];
      const matchInfo = findTagMatch(fullName, tagMap);
      if (!matchInfo) continue;

      const classAttr = line.match(/class=(?:"([^"]*)"|\{([^}]*)\})/);
      const styleAttr = line.match(/style=(?:"([^"]*)"|\{([^}]*)\})/);
      if (!classAttr && !styleAttr) continue;

      const classValue = classAttr ? (classAttr[1] ?? classAttr[2]) : null;
      const styleValue = styleAttr ? (styleAttr[1] ?? styleAttr[2]) : null;
      const isConditional =
        classValue?.includes("?") ||
        classValue?.includes("&&") ||
        false ||
        styleValue?.includes("?") ||
        styleValue?.includes("&&") ||
        false;

      const { component, subComponent } = parseComponentName(
        fullName,
        matchInfo.component,
      );

      results.push({
        file,
        line: i + 1,
        column: (match.index ?? 0) + 1,
        componentImport: matchInfo.importPath,
        tag: `<${fullName}`,
        component,
        subComponent,
        classValue,
        styleValue,
        isConditional,
      });
    }
  }

  return results;
}

async function main() {
  const components = await listUiComponents(UI_DIR);
  const files = await fg([
    "src/**/*.{svelte,ts,js}",
    "!src/lib/components/ui/**",
  ]);
  const results: AuditEntry[] = [];

  for (const file of files) {
    const source = await readFile(file, "utf-8");
    const ext = path.extname(file);

    if (ext === ".svelte") {
      results.push(...auditSvelteFile(file, source, components));
    } else {
      results.push(...auditTsJsFile(file, source, components));
    }
  }

  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(results, null, 2));
  console.log(
    `Audited ${results.length} class/style usages across ${files.length} files.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
