import type { Root } from "hast";
import rehypeParse from "rehype-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { describe, expect, it } from "vitest";
import {
  isDemoInformationDestination,
  isDemoInformationReadPathname,
} from "@/features/demo/lib/demo-information-paths";
import { prepareDemoInformationHtml } from "@/features/demo/server/demo-information-html";
import { getLegalPageContent } from "@/features/legal/server/legal-content";

const origin = "https://example.test";
function text(html: string) {
  const tree: Root = unified().use(rehypeParse, { fragment: true }).parse(html);
  const values: string[] = [];
  visit(tree, "text", (node) => {
    values.push(node.value);
  });
  return values.join("");
}

it("admits only the existing information page and page-data shapes", () => {
  for (const path of [
    "/terms",
    "/privacy",
    "/guides/markdown-support",
    "/usage/mobile",
    "/usage/bot",
    "/usage/cli",
    "/usage/mcp",
    "/community/comments/guide",
  ]) {
    expect(isDemoInformationReadPathname(path)).toBe(true);
    expect(isDemoInformationReadPathname(`${path}/__data.json`)).toBe(true);
    for (const alias of [
      `${path}/`,
      `${path}/extra`,
      `${path}/__data.json/__data.json`,
      path.toUpperCase(),
    ])
      expect(isDemoInformationReadPathname(alias)).toBe(false);
  }
  for (const path of [
    "/api/docs",
    "/api/mcp",
    "/account",
    "/usage",
    "/guides",
    "/terms\n",
    "/%74erms",
  ])
    expect(isDemoInformationReadPathname(path)).toBe(false);
});

it("keeps local reading and client selection but rejects external actions and unrelated images", () => {
  for (const path of [
    "/usage/mcp?client=claude",
    "/usage/mcp?client=other",
    "/terms#agreement",
    "/images/icon.png",
    "/images/usage/mcp-chatgpt-overview-zh.png",
    "/images/usage/presto-bus.png?retry=1",
  ])
    expect(isDemoInformationDestination(new URL(path, origin), origin)).toBe(
      true,
    );
  for (const href of [
    "https://apps.apple.com/us/app/life-ustc/id1660437438",
    "https://qm.qq.com/q/eOL0WhizeM",
    "https://github.com/Life-USTC/CLI",
    "javascript:alert(1)",
    "/account/sign-in",
    "/api/oauth/authorize",
    "/images/unknown.png",
    "/images/icon.png?url=https://outside.test",
    "https://user:password@example.test/terms",
  ])
    expect(isDemoInformationDestination(new URL(href, origin), origin)).toBe(
      false,
    );
});

it("retains legal text and local links while disabling unavailable actions before SSR", () => {
  const input =
    '<h1>Real terms &amp; privacy</h1><p>Read <a href="/privacy">the policy</a>, <a href="https://outside.test/authorize">external authorization</a> or <a href="javascript:alert(1)">invalid action</a>.</p>';
  const output = prepareDemoInformationHtml(input, "Read only", origin);
  expect(text(output)).toBe(text(input));
  expect(output).toContain('href="/privacy"');
  expect(output).not.toContain('href="https://outside.test');
  expect(output).not.toContain('href="javascript:');
  expect(output.match(/aria-disabled="true"/g)).toHaveLength(2);
  expect(output.match(/aria-description="Read only"/g)).toHaveLength(2);
  expect(output).not.toContain("ariaDescription=");
  expect(output.match(/tabindex="-1"/g)).toHaveLength(2);
  expect(prepareDemoInformationHtml(input, "", origin)).toBe(input);
});

for (const locale of ["en-us", "zh-cn"] as const) {
  describe(`actual legal documents ${locale}`, () => {
    for (const kind of ["terms", "privacy"] as const) {
      it(`preserves every original text node in ${kind}`, () => {
        const source = getLegalPageContent(locale, kind);
        const result = prepareDemoInformationHtml(
          source.renderedHtml,
          "Unavailable",
          origin,
        );
        expect(text(result)).toBe(text(source.renderedHtml));
        expect(text(result)).toContain(source.title);
        expect(result).not.toMatch(/href="https?:/);
        expect(
          prepareDemoInformationHtml(source.renderedHtml, "", origin),
        ).toBe(source.renderedHtml);
      });
    }
  });
}
