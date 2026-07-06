import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const AUDIT_PATH = "docs/superpowers/artifacts/shadcn-class-audit.json";
const CLASSIFIED_PATH =
  "docs/superpowers/artifacts/shadcn-class-audit-classified.json";
const DECISIONS_PATH = "docs/superpowers/artifacts/shadcn-styling-decisions.md";

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

type ClassifiedEntry = AuditEntry & {
  decision: "keep" | "convert" | "review";
  action: string;
  reason: string;
};

const LAYOUT_PREFIXES = [
  // Sizing
  "w-",
  "h-",
  "min-w-",
  "max-w-",
  "min-h-",
  "max-h-",
  "size-",
  // Spacing
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
  "space-x-",
  "space-y-",
  // Flex / grid
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
  // Positioning
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
  // Display
  "block",
  "inline",
  "hidden",
  "contents",
  // Overflow
  "overflow-",
  // Text alignment / wrapping (alignment is layout)
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
  "tabular-nums",
  "text-balance",
  // Group/container helpers
  "group",
  // Object / aspect
  "object-",
  "aspect-",
  // Container / centering
  "container",
  "mx-auto",
  // Table cell alignment
  "align-",
  // Accessibility
  "sr-only",
  "not-sr-only",
  // Misc layout behaviour
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
  // Background
  "bg-",
  // Border color / style / width
  "border",
  "divide-",
  "ring-",
  // Radius
  "rounded-",
  // Shadow
  "shadow-",
  // Typography size / weight / family
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
  // Text color (anything text-* that is not an alignment)
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
  // Opacity / effects / animation
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
  // Stroke / fill
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
  // Remove important modifier before and after stripping variant prefixes.
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

function looksLikeClassString(value: string): boolean {
  // Skip empty literals.
  if (!value.trim()) return false;
  // Multi-word literals are almost certainly class strings.
  if (value.trim().includes(" ")) return true;
  // Single-word literals must look like a Tailwind token to avoid matching
  // arbitrary string values used in comparisons (e.g. "bus", "error").
  const cleaned = stripVariants(cleanToken(value.trim()));
  return isLayoutToken(cleaned) || isStylingToken(cleaned);
}

function parseClassTokens(classValue: string | null): string[] {
  if (!classValue) return [];

  const normalized = classValue
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Quoted string literal: "..."
  if (normalized.startsWith('"') && normalized.endsWith('"')) {
    return normalized.slice(1, -1).split(" ").filter(Boolean);
  }

  // Backtick template: `...`
  if (normalized.startsWith("`") && normalized.endsWith("`")) {
    return normalized.slice(1, -1).split(" ").filter(Boolean);
  }

  // Expression that contains string literals: cn("...", "...") or ternary
  if (
    normalized.startsWith("{") ||
    normalized.includes('"') ||
    normalized.includes("`")
  ) {
    const literals =
      extractStringLiterals(normalized).filter(looksLikeClassString);
    return literals.flatMap((literal) => literal.split(" ")).filter(Boolean);
  }

  return normalized.split(" ").filter(Boolean);
}

function classifyEntry(entry: AuditEntry): ClassifiedEntry {
  // Inline styles are always disallowed.
  if (entry.styleValue) {
    return {
      ...entry,
      decision: "convert",
      action:
        "remove inline style; move to layout wrapper or CSS custom property",
      reason:
        "inline styles on shadcn components are disallowed by the styling policy",
    };
  }

  const rawTokens = parseClassTokens(entry.classValue);

  // Empty class value (e.g. conditional empty string) is layout-neutral.
  if (rawTokens.length === 0) {
    return {
      ...entry,
      decision: "keep",
      action: "no class tokens to remediate",
      reason:
        "empty or expression-only class value with no static styling tokens",
    };
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

  // Dynamic expressions that are not simple quoted strings need human review.
  const classValue = entry.classValue ?? "";
  const isDynamicExpression =
    classValue.startsWith("{") &&
    !classValue.startsWith('{"') &&
    !classValue.startsWith("{`");

  if (
    isDynamicExpression &&
    (stylingTokens.length > 0 || unknownTokens.length > 0)
  ) {
    return {
      ...entry,
      decision: "review",
      action:
        "inspect dynamic expression; convert styling tokens to variants or theme tokens",
      reason: `dynamic class expression may contain styling overrides: ${[...new Set([...stylingTokens, ...unknownTokens])].join(", ")}`,
    };
  }

  if (stylingTokens.length > 0 && layoutTokens.length === 0) {
    return {
      ...entry,
      decision: "convert",
      action: `remove or replace styling tokens: ${[...new Set(stylingTokens)].join(", ")}`,
      reason: "contains only styling overrides (color, typography, surface)",
    };
  }

  if (stylingTokens.length > 0) {
    return {
      ...entry,
      decision: "convert",
      action: `keep layout tokens (${[...new Set(layoutTokens)].join(", ")}); convert styling tokens: ${[...new Set(stylingTokens)].join(", ")}`,
      reason: "mixes layout and styling tokens",
    };
  }

  if (unknownTokens.length > 0) {
    return {
      ...entry,
      decision: "review",
      action: "inspect unrecognized tokens",
      reason: `unrecognized tokens: ${[...new Set(unknownTokens)].join(", ")}`,
    };
  }

  return {
    ...entry,
    decision: "keep",
    action: "no styling overrides present",
    reason: "contains only layout tokens",
  };
}

function componentDisplayName(entry: ClassifiedEntry): string {
  return entry.subComponent
    ? `${entry.component}.${entry.subComponent}`
    : entry.component;
}

function buildTally(
  entries: ClassifiedEntry[],
): Map<string, { keep: number; convert: number; review: number }> {
  const tally = new Map<
    string,
    { keep: number; convert: number; review: number }
  >();
  for (const entry of entries) {
    const name = componentDisplayName(entry);
    const current = tally.get(name) ?? { keep: 0, convert: 0, review: 0 };
    current[entry.decision]++;
    tally.set(name, current);
  }
  return tally;
}

function formatAnnotatedDecisions(entries: ClassifiedEntry[]): string {
  return entries
    .map((entry) => {
      const minimal = {
        file: entry.file,
        line: entry.line,
        tag: entry.tag,
        classValue: entry.classValue,
        styleValue: entry.styleValue,
        decision: entry.decision,
        action: entry.action,
        reason: entry.reason,
      };
      return `- \`${entry.file}:${entry.line}\`  \n  \`\`\`json\n  ${JSON.stringify(minimal, null, 2).replace(/\n/g, "\n  ")}\n  \`\`\``;
    })
    .join("\n\n");
}

async function main() {
  const auditJson = await readFile(AUDIT_PATH, "utf-8");
  const auditEntries: AuditEntry[] = JSON.parse(auditJson);

  const classifiedEntries = auditEntries.map(classifyEntry);

  await mkdir(path.dirname(CLASSIFIED_PATH), { recursive: true });
  await writeFile(
    CLASSIFIED_PATH,
    `${JSON.stringify(classifiedEntries, null, 2)}\n`,
  );

  const tally = buildTally(classifiedEntries);
  const sortedComponents = [...tally.entries()].sort((a, b) => {
    const totalA = a[1].keep + a[1].convert + a[1].review;
    const totalB = b[1].keep + b[1].convert + b[1].review;
    return totalB - totalA || a[0].localeCompare(b[0]);
  });

  const total = classifiedEntries.length;
  const totalKeep = classifiedEntries.filter(
    (e) => e.decision === "keep",
  ).length;
  const totalConvert = classifiedEntries.filter(
    (e) => e.decision === "convert",
  ).length;
  const totalReview = classifiedEntries.filter(
    (e) => e.decision === "review",
  ).length;

  const tallyRows = sortedComponents
    .map(([component, counts]) => {
      const totalComponent = counts.keep + counts.convert + counts.review;
      return `| ${component} | ${totalComponent} | ${counts.convert} | ${counts.keep} | ${counts.review} |`;
    })
    .join("\n");

  const markdown = `# shadcn-svelte Class/Style Decision Matrix

## Allowed (Layout)

| Pattern | Example | Rationale |
|---|---|---|
| Sizing | \`w-full\`, \`w-fit\`, \`min-w-0\`, \`max-w-md\`, \`h-[min(70vh,32rem)]\`, \`size-7\` | Components have no container knowledge. |
| Spacing | \`p-0\`, \`px-6\`, \`py-6\`, \`gap-2\`, \`gap-4\` | Parent layout responsibility. |
| Flex/Grid layout | \`flex\`, \`flex-col\`, \`items-start\`, \`justify-center\`, \`grid\`, \`grid-cols-2\` | Parent layout responsibility. |
| Positioning | \`absolute top-2 right-2\`, \`lg:sticky lg:top-20\` | Component-agnostic layout. |
| Typography alignment | \`text-center\`, \`text-right\` | Alignment is layout, not type style. |
| Overflow/scroll | \`overflow-hidden\`, \`min-h-24\` | Layout behavior. |
| Accessibility | \`sr-only\` | Required for a11y, not styling. |

## Convert to Variant or Token (Styling Override)

| Pattern | Example | Action |
|---|---|---|
| Background color | \`bg-[#f6f8fa]\`, \`bg-muted/30\`, \`bg-background\` when used to override component surface | Use component's built-in surface or add a semantic CSS variable if the surface is intentional. |
| Border color/width | \`border\`, \`border-l-4\`, \`border-border\` when overriding default | Prefer \`variant="outline"\` or theme tokens; remove if redundant. |
| Text color/size/weight | \`text-2xl\`, \`text-sm\`, \`font-medium\`, \`text-muted-foreground\` on shadcn sub-components | Use component props or semantic tokens; remove typography overrides on \`Card.Title\`, \`Alert.Title\`, etc. |
| Radius | \`rounded-lg\` on components that already have radius | Remove; use theme \`--radius\` or a component prop if exposed. |
| Shadow | \`shadow-sm\` etc. | Remove; components handle elevation. |
| Inline style | \`style="..."\` | Move to a layout wrapper or a CSS custom property. |

## Remediation Tally

Total usages: **${total}** — keep: **${totalKeep}**, convert: **${totalConvert}**, review: **${totalReview}**.

| Component | Usages | Convert | Keep | Review |
|---|---|---|---|---|
${tallyRows}

## Annotated Decisions

${formatAnnotatedDecisions(classifiedEntries)}
`;

  await writeFile(DECISIONS_PATH, markdown);

  console.log(
    `Classified ${classifiedEntries.length} usages: keep=${totalKeep}, convert=${totalConvert}, review=${totalReview}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
