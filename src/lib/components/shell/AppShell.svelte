<script lang="ts">
import BookOpenIcon from "@lucide/svelte/icons/book-open";
import BotIcon from "@lucide/svelte/icons/bot";
import BusFrontIcon from "@lucide/svelte/icons/bus-front";
import CableIcon from "@lucide/svelte/icons/cable";
import CalendarDaysIcon from "@lucide/svelte/icons/calendar-days";
import ChartBarIcon from "@lucide/svelte/icons/chart-bar";
import ClipboardCheckIcon from "@lucide/svelte/icons/clipboard-check";
import CompassIcon from "@lucide/svelte/icons/compass";
import GavelIcon from "@lucide/svelte/icons/gavel";
import GraduationCapIcon from "@lucide/svelte/icons/graduation-cap";
import HouseIcon from "@lucide/svelte/icons/house";
import KeyRoundIcon from "@lucide/svelte/icons/key-round";
import LinkIcon from "@lucide/svelte/icons/link";
import ListTodoIcon from "@lucide/svelte/icons/list-todo";
import MapIcon from "@lucide/svelte/icons/map";
import RouteIcon from "@lucide/svelte/icons/route";
import ScrollTextIcon from "@lucide/svelte/icons/scroll-text";
import SmartphoneIcon from "@lucide/svelte/icons/smartphone";
import TerminalIcon from "@lucide/svelte/icons/terminal";
import UsersIcon from "@lucide/svelte/icons/users";
import { onMount } from "svelte";
import AdminMobileNav from "@/features/admin/components/AdminMobileNav.svelte";
import { afterNavigate, goto } from "$app/navigation";
import { navigating, page } from "$app/stores";
import { shouldRedirectIncompleteProfileToWelcome } from "$lib/auth/auth-routing";
import {
  isApplePlatform,
  isGlobalSearchShortcut,
} from "$lib/browser/page-search-shortcut";
import AppFooter from "$lib/components/shell/AppFooter.svelte";
import AppSidebar from "$lib/components/shell/AppSidebar.svelte";
import AppTopbar from "$lib/components/shell/AppTopbar.svelte";
import {
  loadStoredThemeMode,
  SHELL_THEME_CHANGE_EVENT,
  setStoredThemeMode,
} from "$lib/components/shell/app-shell-actions";
import {
  applyShellTheme,
  buildFooterLinks,
  isDetailWorkspacePath,
  resolveAvatarFallback,
  resolveProfileHref,
  shouldShowAppFooter,
  shouldUseFocusedShell,
  type ThemeMode,
} from "$lib/components/shell/layout-shell";
import MobilePrimaryNav from "$lib/components/shell/MobilePrimaryNav.svelte";
import RouteLoadingBar from "$lib/components/shell/RouteLoadingBar.svelte";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import { setClientLocale } from "$lib/locale/client-locale";
import type {
  LayoutCopy,
  LayoutUserSummary,
} from "$lib/shell/layout-server-data";
import {
  getClientShellBootstrap,
  type WorkspaceNavigationSummary,
  workspaceNavigationFromPageData,
} from "$lib/shell/shell-bootstrap";
import { cn } from "$lib/utils.js";
import { buildDetailSecondaryLinks } from "./shell-nav-helpers";
import type { ShellLink, ShellNavGroup } from "./types";

type AppShellData = {
  copy: LayoutCopy;
  locale: "en-us" | "zh-cn";
  resolveViewerOnClient: boolean;
  user: LayoutUserSummary;
};

export let data: AppShellData;

let themeMode: ThemeMode = "system";
let sidebarOpen = true;
let globalSearchOpen = false;
let GlobalSearchDialog:
  | typeof import("$lib/components/shell/GlobalSearchDialog.svelte").default
  | null = null;
let userMenuOpen = false;
let localeMenuOpen = false;
let themeMenuOpen = false;
let contentScrollContainer: HTMLElement | undefined;
let viewerLoading = data.resolveViewerOnClient && !data.user;
let viewerUser = data.user;
let workspaceNavigation: WorkspaceNavigationSummary | null = null;
let shellBootstrapAbortController: AbortController | null = null;
let shellBootstrapGeneration = 0;

$: if (!data.resolveViewerOnClient || data.user) {
  if (viewerUser?.id !== data.user?.id) {
    cancelShellBootstrap();
    workspaceNavigation = null;
  }
  viewerUser = data.user;
  viewerLoading = false;
}
$: pageWorkspaceNavigation = workspaceNavigationFromPageData(
  $page.data,
  viewerUser?.id,
);
$: if (pageWorkspaceNavigation) {
  workspaceNavigation = pageWorkspaceNavigation;
}
$: profileHref = resolveProfileHref(viewerUser);
$: avatarFallback = resolveAvatarFallback(viewerUser);
$: navGroups = buildShellNavGroups(
  data.copy,
  Boolean(viewerUser),
  viewerUser?.isAdmin ?? false,
  $page.url.pathname,
  $page.data,
  workspaceNavigation,
);
$: mobileNavGroups = viewerUser
  ? buildMobileSecondaryNavGroups(
      data.copy,
      viewerUser.isAdmin,
      $page.url.pathname,
      $page.data,
      workspaceNavigation,
    )
  : navGroups;
$: mobilePrimaryLinks = buildMobilePrimaryLinks(data.copy);
$: adminRoute =
  $page.url.pathname === "/admin" || $page.url.pathname.startsWith("/admin/");
$: adminMobileLinks = buildAdminShellLinks(data.copy);
$: mobileSecondaryHasActive =
  Boolean($page.url.pathname) &&
  mobileNavGroups.some((group) =>
    group.links.some((link) => linkHasActiveDestination(link)),
  );
$: detailWorkspace = isDetailWorkspacePath($page.url.pathname);
$: focusedShell = shouldUseFocusedShell($page.url.pathname);
$: showFooter = shouldShowAppFooter($page.url.pathname, Boolean(viewerUser));
$: mainContentLabel = resolveMainContentLabel($page.data);
const footerLinks = buildFooterLinks(data.copy.footer);

$: globalSearchShortcutLabel = isApplePlatform()
  ? data.copy.globalSearch.shortcutMac
  : data.copy.globalSearch.shortcut;

async function ensureGlobalSearchDialog() {
  GlobalSearchDialog ??= (
    await import("$lib/components/shell/GlobalSearchDialog.svelte")
  ).default;
}

async function openGlobalSearch() {
  await ensureGlobalSearchDialog();
  globalSearchOpen = true;
}

async function handleGlobalSearchKeydown(event: KeyboardEvent) {
  if (shouldUseFocusedShell($page.url.pathname)) return;
  if (!isGlobalSearchShortcut(event)) return;
  event.preventDefault();
  await openGlobalSearch();
}

function resolveMainContentLabel(pageData: Record<string, unknown>) {
  const label = pageData.mainContentLabel;
  return typeof label === "string" && label.trim() ? label : undefined;
}

function buildShellNavGroups(
  copy: LayoutCopy,
  signedIn: boolean,
  isAdmin: boolean,
  pathname: string,
  pageData: Record<string, unknown>,
  workspaceNavigation: WorkspaceNavigationSummary | null,
): ShellNavGroup[] {
  const detailSecondaryLinks = isDetailWorkspacePath(pathname)
    ? undefined
    : buildDetailSecondaryLinks(pathname, pageData);
  const catalogLinks: ShellLink[] = [
    {
      href: "/catalog/courses",
      icon: BookOpenIcon,
      label: copy.nav.courses,
      items: pathname.startsWith("/catalog/courses/")
        ? detailSecondaryLinks
        : undefined,
    },
    {
      href: "/catalog/sections",
      icon: RouteIcon,
      label: copy.nav.sections,
      items: pathname.startsWith("/catalog/sections/")
        ? detailSecondaryLinks
        : undefined,
    },
    {
      href: "/catalog/teachers",
      icon: UsersIcon,
      label: copy.nav.teachers,
      items: pathname.startsWith("/catalog/teachers/")
        ? detailSecondaryLinks
        : undefined,
    },
    {
      href: "/catalog/bus",
      icon: BusFrontIcon,
      label: copy.nav.bus,
      items: [
        {
          href: "/catalog/bus/map",
          icon: MapIcon,
          label: copy.nav.transitMap,
        },
      ],
    },
    { href: "/catalog/links", icon: LinkIcon, label: copy.nav.links },
  ];
  const usageLinks: ShellLink[] = [
    {
      href: "/usage/mobile",
      icon: SmartphoneIcon,
      label: copy.nav.mobileApp,
    },
    { href: "/usage/bot", icon: BotIcon, label: copy.nav.prestoBot },
    { href: "/usage/mcp", icon: CableIcon, label: copy.nav.mcp },
    { href: "/usage/cli", icon: TerminalIcon, label: copy.nav.cli },
  ];
  if (!signedIn) {
    return [
      {
        defaultOpen: true,
        label: copy.nav.groups.catalog,
        links: catalogLinks,
      },
      {
        defaultOpen: true,
        label: copy.nav.groups.usage,
        links: usageLinks,
      },
    ];
  }

  return [
    {
      defaultOpen: true,
      label: copy.nav.groups.workspace,
      links: [
        {
          ariaLabel: copy.nav.today,
          href: "/workspace/overview",
          icon: HouseIcon,
          label: copy.nav.today,
        },
        {
          ariaLabel: copy.nav.calendar,
          badge: workspaceNavigation?.calendarItemsCount,
          href: "/workspace/calendar",
          icon: CalendarDaysIcon,
          label: copy.nav.calendar,
        },
        {
          ariaLabel: copy.nav.homeworks,
          badge: workspaceNavigation?.pendingHomeworksCount,
          href: "/workspace/homeworks",
          icon: BookOpenIcon,
          label: copy.nav.homeworks,
        },
        {
          ariaLabel: copy.nav.todos,
          badge: workspaceNavigation?.pendingTodosCount,
          href: "/workspace/todos",
          icon: ListTodoIcon,
          label: copy.nav.todos,
        },
        {
          ariaLabel: copy.nav.exams,
          badge: workspaceNavigation?.examsCount,
          href: "/workspace/exams",
          icon: GraduationCapIcon,
          label: copy.nav.exams,
        },
        {
          ariaLabel: copy.nav.subscriptions,
          badge: workspaceNavigation?.subscribedSectionCount,
          href: "/workspace/subscriptions",
          icon: RouteIcon,
          label: copy.nav.subscriptions,
        },
      ],
    },
    {
      defaultOpen: true,
      label: copy.nav.groups.catalog,
      links: catalogLinks,
    },
    {
      defaultOpen: true,
      label: copy.nav.groups.usage,
      links: usageLinks,
    },
    ...(isAdmin
      ? [
          {
            defaultOpen: pathname.startsWith("/admin"),
            label: copy.nav.groups.adminTools,
            links: buildAdminShellLinks(copy),
          },
        ]
      : []),
  ];
}

function buildAdminShellLinks(copy: LayoutCopy): ShellLink[] {
  return [
    {
      href: "/admin/users",
      icon: UsersIcon,
      label: copy.nav.admin.users,
    },
    {
      href: "/admin/moderation",
      icon: GavelIcon,
      label: copy.nav.admin.moderation,
    },
    {
      href: "/admin/oauth",
      icon: KeyRoundIcon,
      label: copy.nav.admin.oauth,
    },
    {
      href: "/admin/bus",
      icon: BusFrontIcon,
      label: copy.nav.admin.bus,
    },
    {
      href: "/admin/audit",
      icon: ScrollTextIcon,
      label: copy.nav.admin.audit,
    },
    {
      href: "/admin/analytics",
      icon: ChartBarIcon,
      label: copy.nav.admin.analytics,
    },
  ];
}

function buildMobileSecondaryNavGroups(
  copy: LayoutCopy,
  isAdmin: boolean,
  pathname: string,
  pageData: Record<string, unknown>,
  workspaceNavigation: WorkspaceNavigationSummary | null,
): ShellNavGroup[] {
  const detailSecondaryLinks = isDetailWorkspacePath(pathname)
    ? undefined
    : buildDetailSecondaryLinks(pathname, pageData);
  const secondaryLinks: ShellLink[] = [
    {
      ariaLabel: copy.nav.todos,
      badge: workspaceNavigation?.pendingTodosCount,
      href: "/workspace/todos",
      icon: ListTodoIcon,
      label: copy.nav.todos,
    },
    {
      ariaLabel: copy.nav.exams,
      badge: workspaceNavigation?.examsCount,
      href: "/workspace/exams",
      icon: GraduationCapIcon,
      label: copy.nav.exams,
    },
    {
      ariaLabel: copy.nav.subscriptions,
      badge: workspaceNavigation?.subscribedSectionCount,
      href: "/workspace/subscriptions",
      icon: RouteIcon,
      label: copy.nav.subscriptions,
    },
    {
      href: "/catalog/bus",
      icon: BusFrontIcon,
      label: copy.nav.bus,
      items: [
        {
          href: "/catalog/bus/map",
          icon: MapIcon,
          label: copy.nav.transitMap,
        },
      ],
    },
    {
      href: "/catalog/links",
      icon: LinkIcon,
      label: copy.nav.links,
    },
    {
      href: "/catalog/sections",
      icon: RouteIcon,
      items: pathname.startsWith("/catalog/sections/")
        ? detailSecondaryLinks
        : undefined,
      label: copy.nav.sections,
    },
    {
      href: "/catalog/teachers",
      icon: UsersIcon,
      items: pathname.startsWith("/catalog/teachers/")
        ? detailSecondaryLinks
        : undefined,
      label: copy.nav.teachers,
    },
  ];
  return [
    {
      defaultOpen: true,
      label: copy.nav.groups.secondary,
      links: secondaryLinks,
    },
    {
      defaultOpen: pathname.startsWith("/usage/"),
      label: copy.nav.groups.usage,
      links: [
        {
          href: "/usage/mobile",
          icon: SmartphoneIcon,
          label: copy.nav.mobileApp,
        },
        { href: "/usage/bot", icon: BotIcon, label: copy.nav.prestoBot },
        { href: "/usage/mcp", icon: CableIcon, label: copy.nav.mcp },
        { href: "/usage/cli", icon: TerminalIcon, label: copy.nav.cli },
      ],
    },
    ...(isAdmin
      ? [
          {
            defaultOpen: pathname.startsWith("/admin"),
            label: copy.nav.groups.adminTools,
            links: buildAdminShellLinks(copy),
          },
        ]
      : []),
  ];
}

function buildMobilePrimaryLinks(copy: LayoutCopy): ShellLink[] {
  return [
    {
      href: "/workspace/overview",
      icon: HouseIcon,
      label: copy.nav.today,
    },
    {
      href: "/workspace/calendar",
      icon: CalendarDaysIcon,
      label: copy.nav.calendar,
    },
    {
      href: "/workspace/homeworks",
      icon: ClipboardCheckIcon,
      label: copy.nav.tasks,
    },
    {
      href: "/catalog/courses",
      icon: CompassIcon,
      label: copy.nav.explore,
    },
  ];
}

function isActiveLink(link: ShellLink) {
  if (!link.href.startsWith("/")) return false;
  const target = new URL(link.href, $page.url.origin);
  const pathname = $page.url.pathname;

  if (target.pathname === "/workspace/overview") {
    return pathname === "/workspace" || pathname === "/workspace/overview";
  }
  if (target.pathname.startsWith("/workspace/")) {
    return pathname === target.pathname;
  }
  if (
    ["/catalog/courses", "/catalog/sections", "/catalog/teachers"].includes(
      target.pathname,
    )
  ) {
    return (
      pathname === target.pathname || pathname.startsWith(`${target.pathname}/`)
    );
  }
  if (target.pathname === "/account/settings/profile") {
    return (
      pathname === "/account/settings" ||
      pathname.startsWith("/account/settings/")
    );
  }
  if (target.pathname.startsWith("/admin/")) {
    return (
      pathname === target.pathname || pathname.startsWith(`${target.pathname}/`)
    );
  }
  return pathname === target.pathname;
}

function linkHasActiveDestination(link: ShellLink): boolean {
  return (
    isActiveLink(link) ||
    (link.items?.some((item) => linkHasActiveDestination(item)) ?? false)
  );
}

function isMobilePrimaryActive(link: ShellLink): boolean {
  const pathname = $page.url.pathname;

  if (link.href === "/workspace/homeworks") {
    return [
      "/workspace/homeworks",
      "/workspace/todos",
      "/workspace/exams",
      "/workspace/subscriptions",
    ].includes(pathname);
  }
  if (link.href === "/catalog/courses") {
    return (
      ["/catalog/bus", "/catalog/links", "/catalog/bus/map"].includes(
        pathname,
      ) ||
      pathname.startsWith("/usage/") ||
      ["/catalog/courses", "/catalog/sections", "/catalog/teachers"].some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      )
    );
  }
  return isActiveLink(link);
}

function setThemeMode(nextThemeMode: ThemeMode) {
  themeMode = setStoredThemeMode(nextThemeMode);
  themeMenuOpen = false;
}

function setUserMenuOpen(open: boolean) {
  userMenuOpen = open;
  if (open) {
    localeMenuOpen = false;
    themeMenuOpen = false;
  }
}

function setLocaleMenuOpen(open: boolean) {
  localeMenuOpen = open;
  if (open) {
    userMenuOpen = false;
    themeMenuOpen = false;
  }
}

function setThemeMenuOpen(open: boolean) {
  themeMenuOpen = open;
  if (open) {
    userMenuOpen = false;
    localeMenuOpen = false;
  }
}

function closeMenus() {
  userMenuOpen = false;
  localeMenuOpen = false;
  themeMenuOpen = false;
}

function resetContentScroll() {
  contentScrollContainer?.scrollTo({ left: 0, top: 0 });
  document
    .querySelector<HTMLElement>("[data-detail-scroll-container]")
    ?.scrollTo({ left: 0, top: 0 });
}

function cancelShellBootstrap() {
  shellBootstrapGeneration += 1;
  shellBootstrapAbortController?.abort();
  shellBootstrapAbortController = null;
}

async function resolveClientShell() {
  const serverNavigation = workspaceNavigationFromPageData(
    $page.data,
    viewerUser?.id,
  );
  if (serverNavigation) workspaceNavigation = serverNavigation;
  if (viewerUser && workspaceNavigation?.userId === viewerUser.id) return;
  if (!data.resolveViewerOnClient && !viewerUser) return;

  cancelShellBootstrap();
  const controller = new AbortController();
  shellBootstrapAbortController = controller;
  const generation = shellBootstrapGeneration;

  try {
    const bootstrap = await getClientShellBootstrap(
      globalThis.fetch,
      controller.signal,
    );
    if (controller.signal.aborted || generation !== shellBootstrapGeneration) {
      return;
    }
    viewerUser = bootstrap.viewer;
    workspaceNavigation = bootstrap.navigation;
    viewerLoading = false;
    if (
      shouldRedirectIncompleteProfileToWelcome({
        pathname: $page.url.pathname,
        url: $page.url,
        hasUser: Boolean(viewerUser?.id),
        hasCompleteProfile: Boolean(viewerUser?.name && viewerUser.username),
      })
    ) {
      const returnTo = `${$page.url.pathname}${$page.url.search}`;
      await goto(
        `/account/welcome?callbackUrl=${encodeURIComponent(returnTo)}`,
      );
    }
  } catch {
    if (controller.signal.aborted || generation !== shellBootstrapGeneration) {
      return;
    }
    if (!viewerUser) workspaceNavigation = null;
  } finally {
    if (shellBootstrapAbortController === controller) {
      shellBootstrapAbortController = null;
    }
  }
}

async function setLocale(locale: "en-us" | "zh-cn") {
  await setClientLocale({
    currentLocale: data.locale,
    locale,
    onBeforeRequest: closeMenus,
  });
}

onMount(() => {
  if (window.matchMedia("(max-width: 1023px)").matches) {
    sidebarOpen = false;
  }
  void resolveClientShell();
  themeMode = loadStoredThemeMode(themeMode);
  applyShellTheme(themeMode);
  document.documentElement.dataset.lifeUstcHydrated = "true";
  window.addEventListener("keydown", handleGlobalSearchKeydown);

  const syncThemeMode = (event: Event) => {
    const nextThemeMode = (event as CustomEvent<ThemeMode>).detail;
    if (
      nextThemeMode === "system" ||
      nextThemeMode === "light" ||
      nextThemeMode === "dark"
    ) {
      themeMode = nextThemeMode;
    }
  };
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const applySystemTheme = () => {
    if (themeMode === "system") applyShellTheme(themeMode);
  };
  window.addEventListener(SHELL_THEME_CHANGE_EVENT, syncThemeMode);
  systemTheme.addEventListener("change", applySystemTheme);

  return () => {
    cancelShellBootstrap();
    window.removeEventListener("keydown", handleGlobalSearchKeydown);
    window.removeEventListener(SHELL_THEME_CHANGE_EVENT, syncThemeMode);
    systemTheme.removeEventListener("change", applySystemTheme);
  };
});

afterNavigate(({ from, to }) => {
  if (!from || !to) return;
  if (
    from.url.pathname === to.url.pathname &&
    from.url.search === to.url.search
  ) {
    return;
  }
  resetContentScroll();
});
</script>

<style>
  @keyframes -global-route-loading-bar {
    0% {
      transform: translateX(-120%);
    }
    55% {
      transform: translateX(35%);
    }
    100% {
      transform: translateX(320%);
    }
  }
</style>

<a
  class="sr-only top-3 left-3 z-50 rounded-md bg-background px-4 py-2 font-medium text-foreground shadow-lg outline-none focus:fixed focus:not-sr-only focus-visible:ring-2 focus-visible:ring-ring"
  href="#main-content"
>
  {data.copy.shell.skipToMainContent}
</a>

{#if $navigating}
  <RouteLoadingBar loadingLabel={data.copy.shell.loading} />
{/if}

{#if focusedShell}
  <div class="flex min-h-screen flex-col" data-shell="focused">
    <AppTopbar
      {closeMenus}
      copy={data.copy}
      focused
      globalSearchShortcutLabel={globalSearchShortcutLabel}
      locale={data.locale}
      {localeMenuOpen}
      onOpenGlobalSearch={openGlobalSearch}
      {setLocale}
      {setLocaleMenuOpen}
      {setThemeMenuOpen}
      {setThemeMode}
      {themeMenuOpen}
      {themeMode}
      signedIn={Boolean(viewerUser)}
      user={viewerUser}
      {viewerLoading}
    />

    <!-- svelte-ignore a11y_no_noninteractive_tabindex -- skip-link target -->
    <main
      aria-label={mainContentLabel}
      bind:this={contentScrollContainer}
      class="flex min-w-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-5 lg:px-6"
      data-shell-scroll-container
      id="main-content"
      tabindex={-1}
    >
      <slot />
    </main>
  </div>
{:else}
  <Sidebar.Provider
    bind:open={sidebarOpen}
    class={cn(
      "flex min-h-screen flex-col lg:h-screen lg:min-h-0 lg:overflow-hidden",
      viewerUser && "pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0",
    )}
  >
    <div class="flex min-h-0 w-full flex-1">
      <AppSidebar
        {avatarFallback}
        {closeMenus}
        copy={data.copy}
        currentPathname={$page.url.pathname}
        dockAboveFooter={showFooter}
        {isActiveLink}
        {mobileNavGroups}
        {navGroups}
        {profileHref}
        {setUserMenuOpen}
        showAccountFooter={!showFooter}
        user={viewerUser}
        {userMenuOpen}
        {viewerLoading}
      />

      <Sidebar.Inset
        aria-label={mainContentLabel}
        id="main-content"
        tabindex={-1}
        class="relative flex w-full min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-hidden"
      >
        <AppTopbar
          {closeMenus}
          copy={data.copy}
          globalSearchShortcutLabel={globalSearchShortcutLabel}
          locale={data.locale}
          {localeMenuOpen}
          onOpenGlobalSearch={openGlobalSearch}
          {setLocale}
          {setLocaleMenuOpen}
          {setThemeMenuOpen}
          {setThemeMode}
          {themeMenuOpen}
          {themeMode}
          signedIn={Boolean(viewerUser)}
          user={viewerUser}
          {viewerLoading}
        />

        <!-- svelte-ignore a11y_no_noninteractive_tabindex -- the desktop content region is the keyboard-scrollable viewport -->
        <div
          bind:this={contentScrollContainer}
          aria-label={data.copy.shell.scrollRegion}
          data-shell-scroll-container
          role="region"
          tabindex="0"
          class={cn(
            "flex min-w-0 flex-1 flex-col",
            detailWorkspace
              ? "lg:min-h-0 lg:overflow-hidden"
              : "lg:min-h-0 lg:overflow-y-auto",
          )}
        >
          <div
            class={cn(
              "w-full flex-1",
              detailWorkspace
                ? "bg-card p-0 lg:min-h-0 lg:overflow-hidden"
                : "px-4 py-4 sm:px-5 lg:px-6",
            )}
          >
            <slot />
          </div>
        </div>
      </Sidebar.Inset>
    </div>

    {#if showFooter}
      <AppFooter
        {avatarFallback}
        {closeMenus}
        copy={data.copy}
        currentPathname={$page.url.pathname}
        {footerLinks}
        {profileHref}
        {setUserMenuOpen}
        user={viewerUser}
        {userMenuOpen}
        {viewerLoading}
      />
    {/if}

    {#if viewerUser}
      {#if viewerUser.isAdmin && adminRoute}
        <AdminMobileNav
          copy={data.copy}
          isActiveLink={isActiveLink}
          links={adminMobileLinks}
        />
      {:else}
        <MobilePrimaryNav
          copy={data.copy}
          hasSecondaryCurrent={mobileSecondaryHasActive}
          isActiveLink={isMobilePrimaryActive}
          links={mobilePrimaryLinks}
        />
      {/if}
    {/if}
  </Sidebar.Provider>
{/if}

{#if GlobalSearchDialog && !focusedShell}
  <svelte:component
    this={GlobalSearchDialog}
    copy={data.copy.globalSearch}
    locale={data.locale}
    bind:open={globalSearchOpen}
    signedIn={Boolean(viewerUser)}
    on:openChange={(event) => {
      globalSearchOpen = event.detail;
    }}
  />
{/if}
