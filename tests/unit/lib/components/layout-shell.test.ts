import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isOnboardingPath,
  isSignInPath,
  resolveMobileToastBottomOffset,
  resolveShellTheme,
} from "@/lib/components/shell/layout-shell";
import { shellPresentation } from "@/lib/components/shell/shell-templates";

describe("application shell template footer policy", () => {
  it.each([
    ["standard", false, "public"],
    ["standard", true, "public"],
    ["home", false, "public"],
    ["home", true, "sidebar"],
    ["workspace", true, "sidebar"],
    ["settings", true, "sidebar"],
    ["academic-detail", false, "sidebar"],
    ["academic-detail", true, "sidebar"],
    ["young-detail", false, "public"],
    ["young-detail", true, "public"],
    ["focused", false, "none"],
    ["focused", true, "none"],
  ])(
    "template %s with signedIn=%s places legal links in %s",
    (template, signedIn, footer) => {
      expect(shellPresentation(template, Boolean(signedIn)).footer).toBe(
        footer,
      );
    },
  );
  it.each([
    "workspace",
    "settings",
    "academic-detail",
    "young-detail",
    "standard",
    "home",
  ])("keeps %s in the full shell", (template) => {
    expect(shellPresentation(template, true).focused).toBe(false);
  });
  it("declares nested scroll only for academic details", () => {
    for (const template of [
      "workspace",
      "settings",
      "academic-detail",
      "young-detail",
      "standard",
      "home",
      "focused",
    ])
      expect(shellPresentation(template, false).detailScroll).toBe(
        template === "academic-detail",
      );
  });
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

  it("uses focused chrome only when declared by its owning route", () => {
    expect(shellPresentation("focused", false).focused).toBe(true);
    expect(shellPresentation("/account/sign-in", false).focused).toBe(false);
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
    // The visible Home / Demo todos caption needs width beyond a square icon.
    // Keep the 44px target and the same below-320px hiding boundary.
    expect(topbar).toMatch(/class="hidden h-11 min-h-11 min-w-11/);
    expect(topbar).not.toMatch(/class="inline-flex (?:size|h)-11/);
  });
});

describe("application shell footer contrast", () => {
  it("keeps footer links above muted-only weight", async () => {
    const footer = await readFile(
      resolve(process.cwd(), "src/lib/components/shell/AppFooter.svelte"),
      "utf8",
    );
    expect(footer).toContain("text-foreground/90");
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
      'import { page as routePage } from "$app/state";',
    );
    expect(controller).toContain('routePage.url.searchParams.get("message")');
    expect(controller).toContain("_isMounted &&");
    expect(controller).toContain("const mountTimer = setTimeout(() => {");
    // The only mount resource is the deferred-ready timer.
    expect(controller).toMatch(/return \(\) => clearTimeout\(mountTimer\);/);
    expect(controller).toContain(
      "goto(nextUrl, { shallow: true, replace: true })",
    );
    expect(controller).not.toContain("window.history.replaceState");
  });
});
