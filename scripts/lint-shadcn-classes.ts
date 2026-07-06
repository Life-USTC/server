import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { type AST, parse } from "svelte/compiler";

const UI_DIR = "src/lib/components/ui";
const BASELINE_PATH = "scripts/shadcn-lint-baseline.json";

type BaselineEntry = {
  file: string;
  line: number;
  signature: string;
  reason: string;
};

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
  classDirective: string | null;
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
      tagMap.set(match[2], { component, importPath });
    } else if (match[3]) {
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
    const classDirectives = attributes.filter(
      (a): a is AST.ClassDirective => a.type === "ClassDirective",
    );

    if (!classAttr && !styleAttr && classDirectives.length === 0) return;

    const classValue = classAttr
      ? extractAttributeValue(classAttr, source)
      : null;
    const styleValue = styleAttr
      ? extractAttributeValue(styleAttr, source)
      : null;
    const classDirective = classDirectives.length
      ? classDirectives.map((d) => source.slice(d.start, d.end)).join(" ")
      : null;
    const isConditional =
      (classAttr && attributeIsConditional(classAttr)) ||
      (styleAttr && attributeIsConditional(styleAttr)) ||
      classDirectives.length > 0;

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
      classDirective,
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
        classDirective: null,
        isConditional,
      });
    }
  }

  return results;
}

const LAYOUT_PREFIXES = [
  "w-",
  "h-",
  "min-w-",
  "max-w-",
  "min-h-",
  "max-h-",
  "size-",
  "p-",
  "px-",
  "py-",
  "pt-",
  "pb-",
  "pl-",
  "pr-",
  "m-",
  "mx-",
  "my-",
  "mt-",
  "mb-",
  "ml-",
  "mr-",
  "ms-",
  "me-",
  "gap-",
  "flex",
  "grid",
  "items-",
  "justify-",
  "justify-items-",
  "content-",
  "place-",
  "basis-",
  "grow",
  "shrink",
  "order-",
  "col-span-",
  "row-span-",
  "grid-cols-",
  "grid-rows-",
  "grid-flow-",
  "static",
  "fixed",
  "absolute",
  "relative",
  "sticky",
  "top-",
  "bottom-",
  "left-",
  "right-",
  "inset-",
  "z-",
  "block",
  "inline",
  "hidden",
  "contents",
  "overflow-",
  "text-left",
  "text-center",
  "text-right",
  "text-justify",
  "text-start",
  "text-end",
  "whitespace-",
  "break-",
  "truncate",
  "line-clamp-",
  "text-balance",
  "group",
  "object-",
  "aspect-",
  "container",
  "mx-auto",
  "align-",
  "sr-only",
  "not-sr-only",
  "cursor-",
  "pointer-events-",
  "resize-",
  "isolate",
  "isolation-",
  "visible",
  "invisible",
  "float-",
  "clear-",
];

const STYLING_PREFIXES = [
  "bg-",
  "border",
  "divide-",
  "ring-",
  "rounded-",
  "shadow-",
  "text-xs",
  "text-sm",
  "text-base",
  "text-lg",
  "text-xl",
  "text-2xl",
  "text-3xl",
  "text-4xl",
  "text-5xl",
  "text-6xl",
  "text-7xl",
  "text-8xl",
  "text-9xl",
  "text-[",
  "font-",
  "leading-",
  "tracking-",
  "uppercase",
  "lowercase",
  "capitalize",
  "normal-case",
  "italic",
  "not-italic",
  "underline",
  "line-through",
  "no-underline",
  "tabular-nums",
  "text-primary",
  "text-secondary",
  "text-muted",
  "text-accent",
  "text-destructive",
  "text-foreground",
  "text-background",
  "text-card",
  "text-popover",
  "text-border",
  "text-input",
  "text-ring",
  "text-sidebar",
  "opacity-",
  "grayscale",
  "sepia",
  "invert",
  "blur-",
  "brightness-",
  "contrast-",
  "saturate-",
  "hue-rotate-",
  "backdrop-",
  "transition",
  "duration-",
  "delay-",
  "ease-",
  "animate-",
  "stroke-",
  "fill-",
];

function isLayoutToken(token: string): boolean {
  return LAYOUT_PREFIXES.some(
    (prefix) => token === prefix || token.startsWith(prefix),
  );
}

function isStylingToken(token: string): boolean {
  return STYLING_PREFIXES.some(
    (prefix) => token === prefix || token.startsWith(prefix),
  );
}

function stripImportantModifier(token: string): string {
  let cleaned = token;
  while (cleaned.startsWith("!")) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

function stripVariants(token: string): string {
  let cleaned = stripImportantModifier(token);
  const colonIndex = cleaned.lastIndexOf(":");
  if (colonIndex >= 0) {
    cleaned = cleaned.slice(colonIndex + 1);
  }
  return stripImportantModifier(cleaned);
}

function cleanToken(token: string): string {
  return token
    .replace(/^[^a-zA-Z0-9_[\]!-]+/, "")
    .replace(/[^a-zA-Z0-9_[\]/%)-]+$/, "");
}

function extractStringLiterals(expression: string): string[] {
  const literals: string[] = [];
  const quoteRegex = /["']([^"']+)["']/g;
  for (const match of expression.matchAll(quoteRegex)) {
    literals.push(match[1]);
  }
  return literals;
}

function extractTemplateSegments(expression: string): string[] {
  const segments: string[] = [];
  const templateRegex = /`([\s\S]*?)`/g;
  for (const match of expression.matchAll(templateRegex)) {
    const content = match[1];
    const literalParts: string[] = [];
    let current = "";
    let depth = 0;
    let inInterpolation = false;
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const next = content[i + 1];
      if (!inInterpolation) {
        if (char === "$" && next === "{") {
          if (current.trim()) {
            literalParts.push(current.trim());
          }
          current = "";
          inInterpolation = true;
          depth = 1;
          i++;
        } else {
          current += char;
        }
      } else {
        if (char === "{") {
          depth++;
        } else if (char === "}") {
          depth--;
          if (depth === 0) {
            inInterpolation = false;
            current = "";
          }
        }
      }
    }
    if (current.trim() && !inInterpolation) {
      literalParts.push(current.trim());
    }
    segments.push(...literalParts);
  }
  return segments;
}

function containsStylingHelperCall(expression: string): boolean {
  return /\b[A-Za-z_$][\w$]*Class(?:es)?\s*\(/.test(expression);
}

function looksLikeClassString(value: string): boolean {
  if (!value.trim()) return false;
  if (value.trim().includes(" ")) return true;
  const cleaned = stripVariants(cleanToken(value.trim()));
  return isLayoutToken(cleaned) || isStylingToken(cleaned);
}

function parseClassDirectiveTokens(classDirective: string | null): string[] {
  if (!classDirective) return [];
  const tokens: string[] = [];
  const regex = /class:([A-Za-z0-9_\-[\]]+)\s*=/g;
  for (const match of classDirective.matchAll(regex)) {
    tokens.push(match[1]);
  }
  return tokens;
}

function computeSignature(finding: LintFinding): string {
  const value = (
    finding.classValue ??
    finding.styleValue ??
    finding.classDirective ??
    ""
  )
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return value;
}

function parseClassTokens(classValue: string | null): string[] {
  if (!classValue) return [];

  const normalized = classValue
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.startsWith('"') && normalized.endsWith('"')) {
    return normalized.slice(1, -1).split(" ").filter(Boolean);
  }

  if (normalized.startsWith("`") && normalized.endsWith("`")) {
    const segments = extractTemplateSegments(normalized);
    return segments.flatMap((segment) => segment.split(" ")).filter(Boolean);
  }

  if (
    normalized.startsWith("{") ||
    normalized.includes('"') ||
    normalized.includes("`")
  ) {
    const literals = [
      ...extractStringLiterals(normalized).filter(looksLikeClassString),
      ...extractTemplateSegments(normalized).filter(looksLikeClassString),
    ];
    return literals.flatMap((literal) => literal.split(" ")).filter(Boolean);
  }

  return normalized.split(" ").filter(Boolean);
}

type LintFinding = {
  file: string;
  line: number;
  tag: string;
  classValue: string | null;
  styleValue: string | null;
  classDirective: string | null;
  reason: string;
  signature: string;
};

async function loadBaseline(path: string): Promise<BaselineEntry[]> {
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw) as BaselineEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function findingMatchesBaseline(
  finding: LintFinding,
  baseline: BaselineEntry[],
): boolean {
  return baseline.some(
    (entry) =>
      entry.file === finding.file &&
      entry.line === finding.line &&
      entry.signature === finding.signature,
  );
}

function classifyFinding(entry: AuditEntry): LintFinding | null {
  const classValue = entry.classValue ?? "";
  const classDirective = entry.classDirective ?? "";

  function makeFinding(reason: string): LintFinding {
    const finding: LintFinding = {
      file: entry.file,
      line: entry.line,
      tag: entry.tag,
      classValue: entry.classValue,
      styleValue: entry.styleValue,
      classDirective: entry.classDirective,
      reason,
      signature: "",
    };
    finding.signature = computeSignature(finding);
    return finding;
  }

  if (entry.styleValue) {
    return makeFinding("inline style on shadcn component is disallowed");
  }

  if (containsStylingHelperCall(classValue)) {
    return makeFinding(
      "class expression uses a helper that may return raw styling classes",
    );
  }

  const classTokens = parseClassTokens(entry.classValue);
  const directiveTokens = parseClassDirectiveTokens(classDirective);
  const rawTokens = [...classTokens, ...directiveTokens];

  if (rawTokens.length === 0) {
    return null;
  }

  const tokens = rawTokens
    .map((token) => stripVariants(cleanToken(token)))
    .filter(Boolean);

  const stylingTokens: string[] = [];
  const layoutTokens: string[] = [];
  const unknownTokens: string[] = [];

  for (const token of tokens) {
    if (isStylingToken(token)) {
      stylingTokens.push(token);
    } else if (isLayoutToken(token)) {
      layoutTokens.push(token);
    } else {
      unknownTokens.push(token);
    }
  }

  const spaceUtilityTokens = tokens.filter(
    (token) => token.startsWith("space-x-") || token.startsWith("space-y-"),
  );

  if (spaceUtilityTokens.length > 0) {
    return makeFinding(
      `legacy space utilities: ${[...new Set(spaceUtilityTokens)].join(", ")}`,
    );
  }

  const directiveStylingTokens = directiveTokens
    .map((token) => stripVariants(cleanToken(token)))
    .filter(isStylingToken);

  if (directiveStylingTokens.length > 0) {
    return makeFinding(
      `class: directive applies styling override: ${[
        ...new Set(directiveStylingTokens),
      ].join(", ")}`,
    );
  }

  const isDynamicExpression =
    classValue.startsWith("{") &&
    !classValue.startsWith('{"') &&
    !classValue.startsWith("{`");

  if (
    isDynamicExpression &&
    (stylingTokens.length > 0 || unknownTokens.length > 0)
  ) {
    return makeFinding(
      `dynamic class expression may contain styling overrides: ${[
        ...new Set([...stylingTokens, ...unknownTokens]),
      ].join(", ")}`,
    );
  }

  if (stylingTokens.length > 0) {
    return makeFinding(
      `contains styling overrides: ${[...new Set(stylingTokens)].join(", ")}`,
    );
  }

  if (unknownTokens.length > 0) {
    return makeFinding(
      `unrecognized tokens: ${[...new Set(unknownTokens)].join(", ")}`,
    );
  }

  return null;
}

async function main() {
  const updateBaseline = process.argv.includes("--update-baseline");

  const components = await listUiComponents(UI_DIR);
  const baseline = await loadBaseline(BASELINE_PATH);
  const files: string[] = [];
  for await (const file of new Bun.Glob("src/**/*.{svelte,ts,js}").scan(".")) {
    if (file.startsWith("src/lib/components/ui/")) continue;
    files.push(file);
  }
  files.sort();

  const findings: LintFinding[] = [];

  for (const file of files) {
    const source = await readFile(file, "utf-8");
    const ext = path.extname(file);

    const entries =
      ext === ".svelte"
        ? auditSvelteFile(file, source, components)
        : auditTsJsFile(file, source, components);

    for (const entry of entries) {
      const finding = classifyFinding(entry);
      if (finding) findings.push(finding);
    }
  }

  findings.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });

  const known: LintFinding[] = [];
  const unknown: LintFinding[] = [];
  for (const finding of findings) {
    if (findingMatchesBaseline(finding, baseline)) {
      known.push(finding);
    } else {
      unknown.push(finding);
    }
  }

  function findingDetail(finding: LintFinding): string {
    return (
      finding.styleValue ??
      finding.classValue ??
      finding.classDirective ??
      ""
    );
  }

  for (const finding of known) {
    console.warn(
      `${finding.file}:${finding.line} ${finding.tag} ${finding.reason} (${findingDetail(finding)})`,
    );
  }

  for (const finding of unknown) {
    console.log(
      `${finding.file}:${finding.line} ${finding.tag} ${finding.reason} (${findingDetail(finding)})`,
    );
  }

  if (updateBaseline) {
    const newBaseline: BaselineEntry[] = findings.map((finding) => ({
      file: finding.file,
      line: finding.line,
      signature: finding.signature,
      reason: finding.reason,
    }));
    newBaseline.sort((a, b) => {
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      return a.line - b.line;
    });
    await writeFile(BASELINE_PATH, `${JSON.stringify(newBaseline, null, 2)}\n`);
    console.log(`\nUpdated baseline with ${newBaseline.length} entries.`);
    process.exit(0);
  }

  if (unknown.length === 0) {
    if (known.length > 0) {
      console.warn(
        `\n${known.length} known shadcn class/style violation(s) ignored (baseline).`,
      );
    } else {
      console.log("No shadcn class/style violations found.");
    }
    process.exit(0);
  }

  if (known.length > 0) {
    console.warn(
      `\n${known.length} known shadcn class/style violation(s) ignored (baseline).`,
    );
  }
  console.error(`\n${unknown.length} shadcn class/style violation(s) found.`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
