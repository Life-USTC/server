import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EMPTY_VARIANTS } from "#lib/components/empty-variants.js";
import {
  resolveStatusToken,
  STATUS_BADGE_CLASS,
  STATUS_TOKEN_KEYS,
} from "#lib/ui/action-status-tokens.js";

describe("action-status-tokens", () => {
  it("exports status-* roles", () => {
    expect([...STATUS_TOKEN_KEYS]).toEqual([
      "active",
      "open",
      "overdue",
      "ended",
    ]);
    for (const key of STATUS_TOKEN_KEYS) {
      expect(STATUS_BADGE_CLASS[key]).toContain(`bg-status-${key}`);
    }
  });

  it("maps Young and homework status labels onto status tokens", () => {
    expect(resolveStatusToken({ status: "进行中" })).toBe("active");
    expect(resolveStatusToken({ status: "报名中" })).toBe("open");
    expect(resolveStatusToken({ status: "逾期" })).toBe("overdue");
    expect(resolveStatusToken({ status: "已结束" })).toBe("ended");
    expect(resolveStatusToken({ overdue: true })).toBe("overdue");
    expect(resolveStatusToken({ isActive: true })).toBe("active");
    expect(resolveStatusToken({ isActive: false })).toBe("ended");
  });

  it("declares CSS custom properties for every status token", () => {
    const css = readFileSync(resolve("src/routes/svelte.css"), "utf8");
    for (const key of STATUS_TOKEN_KEYS) {
      expect(css).toContain(`--status-${key}:`);
      expect(css).toContain(`--status-${key}-foreground:`);
      expect(css).toContain(`--color-status-${key}:`);
      expect(css).toContain(`--color-status-${key}-foreground:`);
    }
  });
});

describe("empty-variants", () => {
  it("exports filter-clear, browse, setup, and quiet variants", () => {
    expect([...EMPTY_VARIANTS]).toEqual([
      "filter-clear",
      "browse",
      "setup",
      "quiet",
    ]);
  });

  it("ships CollectionEmpty.svelte with the shared variant contract", () => {
    const source = readFileSync(
      resolve("src/lib/components/CollectionEmpty.svelte"),
      "utf8",
    );
    expect(source).toContain("data-empty-variant={variant}");
    expect(source).toContain('variant === "filter-clear" && onClearFilter');
    expect(source).toContain('variant === "quiet"');
  });
});
