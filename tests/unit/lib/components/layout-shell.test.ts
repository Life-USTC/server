import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isDetailWorkspacePath,
  isOnboardingPath,
  isSignInPath,
  isYoungEventDetailPath,
  resolveMobileToastBottomOffset,
  resolveShellTheme,
  shouldShowAppFooter,
  shouldUseFocusedShell,
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
    ["/catalog/young-events/82b85f9952501a0c0303ac31652f19e9", true],
    ["/catalog/young-events", false],
    ["/catalog/young-events/calendar", false],
    ["/catalog/young-events/organizers", false],
    ["/catalog/young-events/organizers/dev-scenario-young-organizer", false],
  ])("identifies young event banner path %s", (pathname, expected) => {
    expect(isYoungEventDetailPath(pathname)).toBe(expected);
  });

  it.each([
    ["/", false, true],
    ["/", true, false],
    ["/workspace", true, false],
    ["/workspace/exams", true, false],
    ["/account/settings/profile", true, false],
    ["/admin/oauth", true, false],
    ["/account/welcome", true, false],
    ["/account/sign-in", false, false],
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

describe("application shell focused chrome", () => {
  it.each([
    ["/account/welcome", true],
    ["/account/welcome/", true],
    ["/account/settings", false],
    ["/workspace/overview", false],
  ])("pathname %s is onboarding=%s", (pathname, expected) => {
    expect(isOnboardingPath(pathname)).toBe(expected);
  });

  it.each([
    ["/account/welcome", true],
    ["/account/welcome/", true],
    ["/account/sign-in", true],
    ["/account/sign-in-other", false],
    ["/account/sign-in/nested", true],
    ["/account/settings", false],
    ["/workspace/overview", false],
  ])("pathname %s uses focused shell=%s", (pathname, expected) => {
    expect(shouldUseFocusedShell(pathname)).toBe(expected);
  });

  it.each([
    ["/account/sign-in", true],
    ["/account/sign-in/", true],
    ["/account/sign-in/nested", true],
    ["/account/sign-in-other", false],
    ["/account/settings", false],
  ])("pathname %s is sign-in=%s", (pathname, expected) => {
    expect(isSignInPath(pathname)).toBe(expected);
  });

  it("omits the topbar Sign in control on the sign-in route", async () => {
    const topbar = await readFile(
      resolve(process.cwd(), "src/lib/components/shell/AppTopbar.svelte"),
      "utf8",
    );
    expect(topbar).toContain("hideSignIn");
    expect(topbar).toContain("!user && !hideSignIn");
  });
});

describe("application shell compact brand", () => {
  it("hides the topbar brand below 320px so 280px viewports do not overflow", async () => {
    const topbar = await readFile(
      resolve(process.cwd(), "src/lib/components/shell/AppTopbar.svelte"),
      "utf8",
    );

    expect(topbar).toContain("data-shell-brand");
    expect(topbar).toContain("min-[320px]:inline-flex");
    expect(topbar).toMatch(/class="hidden size-11/);
    expect(topbar).not.toMatch(/class="inline-flex size-11/);
  });
});

describe("application shell footer contrast", () => {
  it("keeps footer links above muted-only weight", async () => {
    const footer = await readFile(
      resolve(process.cwd(), "src/lib/components/shell/AppFooter.svelte"),
      "utf8",
    );
    expect(footer).toContain("text-foreground/80");
    expect(footer).toContain("bg-muted/40");
    expect(footer).not.toMatch(
      /flex min-w-0 flex-1 items-center justify-between gap-4 bg-background\/80 px-4 text-muted-foreground/,
    );
  });
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
  it.each([
    [false, "calc(env(safe-area-inset-bottom) + 1rem)"],
    [true, "calc(3.5rem + env(safe-area-inset-bottom) + 1rem)"],
  ])(
    "resolveMobileToastBottomOffset(showMobileTabBar=%s)",
    (showMobileTabBar, expected) => {
      expect(resolveMobileToastBottomOffset(showMobileTabBar)).toBe(expected);
    },
  );

  it("defers mobile bottom offset to sonner; layout only sets horizontal inset", async () => {
    // This PR retires fixed mobile tab bars; signed-in lift selectors remain in
    // sonner for any future nav that remounts those data attributes.
    const [layout, sonner] = await Promise.all([
      readFile(resolve(process.cwd(), "src/routes/+layout.svelte"), "utf8"),
      readFile(
        resolve(process.cwd(), "src/lib/components/ui/sonner/sonner.svelte"),
        "utf8",
      ),
    ]);

    expect(layout).toContain('mobileOffset={{ left: "1rem", right: "1rem" }}');
    expect(layout).not.toMatch(/mobileOffset=\{\{[^}]*bottom:/);
    expect(sonner).toContain("mobileToastBottomSignedOut");
    expect(sonner).toContain("mobileToastBottomSignedIn");
    expect(sonner).toContain('[data-shell-navigation="mobile-primary"]');
    expect(sonner).toContain('[data-shell-navigation="admin-mobile"]');
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

    expect(controller).toContain('import { goto } from "$app/navigation";');
    expect(controller).toContain(
      'import { legacyPageStore } from "@/lib/navigation/legacy-page-stores";',
    );
    expect(controller).toContain('$page.url.searchParams.get("message")');
    expect(controller).toContain("_isMounted &&");
    expect(controller).toContain("const mountTimer = setTimeout(() => {");
    expect(controller).toContain("return () => clearTimeout(mountTimer);");
    expect(controller).toContain(
      "goto(nextUrl, { shallow: true, replace: true })",
    );
    expect(controller).not.toContain("window.history.replaceState");
  });
});
