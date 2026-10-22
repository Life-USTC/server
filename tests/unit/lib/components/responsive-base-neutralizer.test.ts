import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";

/**
 * Shared component bases drop their mobile-only floor at a breakpoint, e.g.
 * `button.svelte` carries `min-h-11 … md:min-h-0`. A breakpoint variant is a
 * variant selector, so it outranks every unprefixed utility in the same group
 * and `twMerge` keeps both — a call site that writes `min-h-6` or `sm:min-h-9`
 * still computes `min-height: 0px` above that breakpoint. The declaration is
 * dead, and static review cannot see it.
 *
 * This guard requires every call site that declares one of those groups to also
 * declare the neutralizing breakpoint, so the intent reaches the DOM.
 */

/** Groups whose silent collapse changes a control's box, and its target size. */
const GUARDED_GROUPS = ["min-h", "min-w", "h"] as const;
const BREAKPOINTS = ["sm", "md", "lg", "xl", "2xl"] as const;
type Breakpoint = (typeof BREAKPOINTS)[number];

/** Call-site tag -> the shared source whose base may neutralize a group. */
const SHARED_BASES: Record<string, string> = {
  Button: "src/lib/components/ui/button/button.svelte",
  Toggle: "src/lib/components/ui/toggle/toggle.svelte",
  "ToggleGroup.Item": "src/lib/components/ui/toggle/toggle.svelte",
  "InputGroup.Root": "src/lib/components/ui/input-group/input-group.svelte",
};

/**
 * `InputGroup.Root`'s base also carries `has-[>textarea]:h-auto`, whose (0,2,0)
 * specificity already outranks `md:h-8`, and `MarkdownEditor` always renders a
 * direct `<textarea>` child. Its bare `h-auto` therefore does reach the DOM.
 */
const CLEARED: ReadonlySet<string> = new Set([
  "src/lib/components/MarkdownEditor.svelte:InputGroup.Root:h",
]);

const CLASS_ATTRIBUTE = /(?<![\w-])class="([^"]*)"/;
const ELEMENT =
  /<([A-Z][\w.]*)((?:[^<>'"]|'[^']*'|"[^"]*"|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*?)\/?>/g;

function tokensOf(classValue: string): string[] {
  return classValue.split(/\s+/).filter(Boolean);
}

/** Split a utility token into its variant prefix, group and value. */
function parseToken(
  token: string,
): { breakpoint?: Breakpoint; group: string; value: string } | undefined {
  const breakpoint = BREAKPOINTS.find((candidate) =>
    token.startsWith(`${candidate}:`),
  );
  const bare = breakpoint ? token.slice(breakpoint.length + 1) : token;
  if (bare.includes(":")) return undefined; // another variant, not a plain utility
  const group = GUARDED_GROUPS.find((candidate) =>
    bare.startsWith(`${candidate}-`),
  );
  if (!group) return undefined;
  return { breakpoint, group, value: bare.slice(group.length + 1) };
}

/** `md:min-h-0` in a shared base neutralizes the `min-h` group from `md` up. */
async function neutralizers(
  source: string,
): Promise<Map<string, { breakpoint: Breakpoint; value: string }>> {
  const text = await readFile(source, "utf8");
  const found = new Map<string, { breakpoint: Breakpoint; value: string }>();
  for (const token of text.match(/[\w.:/[\]%-]+/g) ?? []) {
    const parsed = parseToken(token);
    if (!parsed?.breakpoint || found.has(parsed.group)) continue;
    found.set(parsed.group, {
      breakpoint: parsed.breakpoint,
      value: parsed.value,
    });
  }
  return found;
}

async function svelteFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.posix.join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await svelteFiles(full)));
    else if (entry.name.endsWith(".svelte")) files.push(full);
  }
  return files;
}

it("call sites declare the breakpoint a shared base neutralizes", async () => {
  const bases = new Map<
    string,
    Map<string, { breakpoint: Breakpoint; value: string }>
  >();
  for (const [tag, source] of Object.entries(SHARED_BASES)) {
    bases.set(tag, await neutralizers(source));
  }

  const offenders: string[] = [];
  for (const file of await svelteFiles("src")) {
    const text = await readFile(file, "utf8");
    for (const match of text.matchAll(ELEMENT)) {
      const tag = match[1];
      const neutralized = bases.get(tag);
      if (!neutralized) continue;
      const classValue = CLASS_ATTRIBUTE.exec(match[2])?.[1];
      if (classValue === undefined) continue;
      const parsed = tokensOf(classValue)
        .map(parseToken)
        .filter((token) => token !== undefined);

      for (const [group, base] of neutralized) {
        if (CLEARED.has(`${file}:${tag}:${group}`)) continue;
        const floor = BREAKPOINTS.indexOf(base.breakpoint);
        const sameGroup = parsed.filter((token) => token.group === group);
        // Declared below the neutralizing breakpoint, with a different value:
        // the base wins above it and this value never reaches the DOM.
        const lost = sameGroup.filter(
          (token) =>
            token.value !== base.value &&
            (token.breakpoint === undefined ||
              BREAKPOINTS.indexOf(token.breakpoint) < floor),
        );
        if (!lost.length) continue;
        // Any declaration at or above the breakpoint restates the intent there.
        const restated = sameGroup.some(
          (token) =>
            token.breakpoint !== undefined &&
            BREAKPOINTS.indexOf(token.breakpoint) >= floor,
        );
        if (restated) continue;
        const line = text.slice(0, match.index).split("\n").length;
        const declared = lost
          .map(
            (token) =>
              `\`${token.breakpoint ? `${token.breakpoint}:` : ""}${group}-${token.value}\``,
          )
          .join(", ");
        offenders.push(
          `${file}:${line} <${tag}> declares ${declared} but no ` +
            `\`${base.breakpoint}:${group}-*\`, so the shared base's ` +
            `\`${base.breakpoint}:${group}-${base.value}\` discards it above ${base.breakpoint}`,
        );
      }
    }
  }

  expect(offenders).toEqual([]);
});
