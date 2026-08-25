import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isDetailWorkspacePath,
  resolveShellTheme,
  shouldShowAppFooter,
} from "@/lib/components/shell/layout-shell";

describe("application shell footer policy", () => {
  it.each([
    ["/catalog/courses/123", true],
    ["/catalog/sections/123/homework", true],
    ["/catalog/teachers/123", true],
    ["/catalog/courses", false],
  ])("identifies detail workspace path %s", (pathname, expected) => {
    expect(isDetailWorkspacePath(pathname)).toBe(expected);
  });

  it.each([
    ["/", false, true],
    ["/", true, false],
    ["/workspace", true, false],
    ["/workspace/exams", true, false],
    ["/account/settings/profile", true, false],
    ["/admin/oauth", true, false],
    ["/account/welcome", true, false],
    ["/catalog/courses", false, true],
    ["/catalog/courses", true, true],
    ["/guides/markdown-support", true, true],
    ["/catalog/courses/123", false, false],
  ])(
    "pathname %s with signedIn=%s shows footer=%s",
    (pathname, signedIn, expected) => {
      expect(shouldShowAppFooter(pathname, signedIn)).toBe(expected);
    },
  );
});

describe("application shell theme", () => {
  it.each([
    ["light", false, "light"],
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["dark", true, "dark"],
    ["system", false, "light"],
    ["system", true, "dark"],
  ] as const)(
    "resolves %s with prefersDark=%s to %s",
    (mode, prefersDark, expected) => {
      expect(resolveShellTheme(mode, prefersDark)).toBe(expected);
    },
  );
});

describe("mobile toast placement", () => {
  it("keeps bottom toasts above the fixed mobile navigation", async () => {
    const [layout, primaryNav, adminNav, sonner] = await Promise.all([
      readFile(resolve(process.cwd(), "src/routes/+layout.svelte"), "utf8"),
      readFile(
        resolve(
          process.cwd(),
          "src/lib/components/shell/MobilePrimaryNav.svelte",
        ),
        "utf8",
      ),
      readFile(
        resolve(
          process.cwd(),
          "src/features/admin/components/AdminMobileNav.svelte",
        ),
        "utf8",
      ),
      readFile(
        resolve(process.cwd(), "src/lib/components/ui/sonner/sonner.svelte"),
        "utf8",
      ),
    ]);

    expect(layout).toContain(
      'bottom: "calc(3.5rem + env(safe-area-inset-bottom) + 1rem)"',
    );
    expect(layout).toContain('left: "1rem"');
    expect(layout).toContain('right: "1rem"');
    expect(primaryNav).toContain("min-h-14");
    expect(primaryNav).toContain("pb-[env(safe-area-inset-bottom)]");
    expect(adminNav).toContain("min-h-14");
    expect(adminNav).toContain("pb-[env(safe-area-inset-bottom)]");
    expect(sonner).toContain("max-width: calc(100vw");
    expect(sonner).toContain("pointer-events: none;");
    expect(sonner).toContain("pointer-events: auto;");
  });
});

describe("settings redirect success feedback", () => {
  it("consumes redirect markers through SvelteKit navigation state", async () => {
    const controller = await readFile(
      resolve(
        process.cwd(),
        "src/features/settings/components/SettingsPageController.svelte",
      ),
      "utf8",
    );

    expect(controller).toContain(
      'import { replaceState } from "$app/navigation";',
    );
    expect(controller).toContain('import { page } from "$app/stores";');
    expect(controller).toContain('$page.url.searchParams.get("message")');
    expect(controller).toContain("replaceState(nextUrl, {})");
    expect(controller).not.toContain("window.history.replaceState");
  });
});
