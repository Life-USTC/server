<script lang="ts">
import { onMount, setContext } from "svelte";
import { writable } from "svelte/store";
import { shouldRedirectIncompleteProfileToWelcome } from "#lib/auth/auth-routing.js";
import {
  isApplePlatform,
  isGlobalSearchShortcut,
} from "#lib/browser/page-search-shortcut.js";
import AppFooter from "#lib/components/shell/AppFooter.svelte";
import AppSidebar, {
  type SectionSidebar,
} from "#lib/components/shell/AppSidebar.svelte";
import AppTopbar from "#lib/components/shell/AppTopbar.svelte";
import {
  loadStoredThemeMode,
  SHELL_THEME_CHANGE_EVENT,
  setStoredThemeMode,
} from "#lib/components/shell/app-shell-actions.js";
import {
  applyShellTheme,
  buildFooterLinks,
  isDetailWorkspacePath,
  isYoungEventDetailPath,
  resolveAvatarFallback,
  resolveProfileHref,
  shouldShowAppFooter,
  shouldUseFocusedShell,
  type ThemeMode,
} from "#lib/components/shell/layout-shell.js";
import RouteLoadingBar from "#lib/components/shell/RouteLoadingBar.svelte";
import * as Sidebar from "#lib/components/ui/sidebar/index.js";
import { setClientLocale } from "#lib/locale/client-locale.js";
import type {
  LayoutCopy,
  LayoutUserSummary,
} from "#lib/shell/layout-server-data.js";
import {
  type ClientShellNavigationType,
  getClientShellBootstrap,
  shouldRequestClientShellBootstrap,
  type WorkspaceNavigationSummary,
  workspaceNavigationFromPageData,
} from "#lib/shell/shell-bootstrap.js";
import {
  SHELL_VIEWER_CONTEXT,
  type ShellViewerState,
} from "#lib/shell/shell-viewer.js";
import { cn } from "#lib/utils.js";
import {
  legacyNavigatingStore,
  legacyPageStore,
} from "@/lib/navigation/legacy-page-stores";
import { afterNavigate, goto } from "$app/navigation";
import {
  buildAdminNavGroups,
  buildSettingsNavGroups,
  buildShellNavGroups,
  buildYoungNavGroups,
  isShellLinkActive,
} from "./navigation";
import type { ShellLink } from "./types";

const navigating = legacyNavigatingStore();
const page = legacyPageStore();

if (typeof window !== "undefined") {
  const originalFetch = window.fetch.bind(window);
  let navigationCache:
    | Promise<typeof import("#lib/shell/public-navigation-cache.js")>
    | undefined;
  window.fetch = (input, init) => {
    const raw = input instanceof Request ? input.url : String(input);
    if (!raw.includes("__data.json")) return originalFetch(input, init);
    navigationCache ??= import("#lib/shell/public-navigation-cache.js");
    const locale =
      document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]*)/)?.[1] ?? "";
    return navigationCache.then(({ cachedPublicNavigationFetch }) =>
      cachedPublicNavigationFetch(
        originalFetch,
        input,
        init,
        Date.now(),
        locale,
      ),
    );
  };
}

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
  | typeof import("@/features/search/components/GlobalSearchDialog.svelte").default
  | null = null;
let userMenuOpen = false;
let localeMenuOpen = false;
let themeMenuOpen = false;
let contentScrollContainer: HTMLElement | undefined;
let viewerLoading = data.resolveViewerOnClient && !data.user;
let viewerUser = data.user;
let viewerFailed = false;
const shellViewer = writable<ShellViewerState>({
  viewer: viewerUser,
  status: viewerLoading ? "loading" : "ready",
});
setContext(SHELL_VIEWER_CONTEXT, shellViewer);
$: shellViewer.set({
  viewer: viewerUser,
  status: viewerLoading ? "loading" : viewerFailed ? "error" : "ready",
});
let workspaceNavigation: WorkspaceNavigationSummary | null = null;
let shellBootstrapAbortController: AbortController | null = null;
let shellBootstrapGeneration = 0;
let shellResolved = false;

$: if (!data.resolveViewerOnClient || data.user) {
  if (viewerUser?.id !== data.user?.id) {
    cancelShellBootstrap();
    shellResolved = false;
    workspaceNavigation = null;
  }
  viewerUser = data.user;
  viewerLoading = false;
  viewerFailed = false;
}
$: pageWorkspaceNavigation = workspaceNavigationFromPageData(
  $page.data,
  viewerUser?.id,
);
$: if (pageWorkspaceNavigation) {
  workspaceNavigation = pageWorkspaceNavigation;
}
$: if (
  workspaceNavigation &&
  viewerUser?.id &&
  $page.data.userId === viewerUser.id &&
  Number.isSafeInteger($page.data.unreadActivityNotificationsCount) &&
  $page.data.unreadActivityNotificationsCount >= 0 &&
  workspaceNavigation.unreadActivityNotificationsCount !==
    $page.data.unreadActivityNotificationsCount
) {
  workspaceNavigation = {
    ...workspaceNavigation,
    unreadActivityNotificationsCount:
      $page.data.unreadActivityNotificationsCount,
  };
}
$: profileHref = resolveProfileHref(viewerUser);
$: avatarFallback = resolveAvatarFallback(viewerUser);
$: settingsSidebar = isSettingsPath($page.url.pathname);
$: youngSidebar = isYoungPath($page.url.pathname);
$: adminRoute =
  $page.url.pathname === "/admin" || $page.url.pathname.startsWith("/admin/");
$: navViewer = viewerUser
  ? { signedIn: true, isAdmin: viewerUser.isAdmin }
  : null;
$: navContext = {
  pathname: $page.url.pathname,
  pageData: $page.data,
  navigation: workspaceNavigation,
};
$: navGroups = settingsSidebar
  ? buildSettingsNavGroups(data.copy)
  : youngSidebar
    ? buildYoungNavGroups(data.copy, $page.url.pathname, $page.data)
    : adminRoute
      ? buildAdminNavGroups(data.copy, navViewer, navContext)
      : buildShellNavGroups(data.copy, navViewer, navContext);
$: sectionSidebar = settingsSidebar
  ? ({
      backHref: "/",
      backLabel: data.copy.shell.backToHome,
      backTestId: "settings-sidebar-back",
      level: "settings",
      navLabel: data.copy.nav.settings,
      testId: "settings-sidebar",
    } satisfies SectionSidebar)
  : youngSidebar
    ? ({
        backHref: "/",
        backLabel: data.copy.shell.backToHome,
        backTestId: "young-sidebar-back",
        level: "young",
        navLabel: data.copy.nav.youngEvents,
        testId: "young-sidebar",
      } satisfies SectionSidebar)
    : adminRoute
      ? ({
          backHref: "/",
          backLabel: data.copy.shell.backToApp,
          backTestId: "admin-sidebar-back",
          level: "admin",
          navLabel: data.copy.nav.admin.title,
          testId: "admin-sidebar",
        } satisfies SectionSidebar)
      : null;
$: detailWorkspace = isDetailWorkspacePath($page.url.pathname);
$: youngEventBanner = isYoungEventDetailPath($page.url.pathname);
$: focusedShell = shouldUseFocusedShell($page.url.pathname);
$: showFooter = shouldShowAppFooter($page.url.pathname, Boolean(viewerUser));
$: mainContentLabel = resolveMainContentLabel($page.data);
const footerLinks = buildFooterLinks(data.copy.footer);

$: globalSearchShortcutLabel = isApplePlatform()
  ? data.copy.globalSearch.shortcutMac
  : data.copy.globalSearch.shortcut;

async function ensureGlobalSearchDialog() {
  GlobalSearchDialog ??= (
    await import("@/features/search/components/GlobalSearchDialog.svelte")
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

function isSettingsPath(pathname: string) {
  return (
    pathname === "/account/settings" ||
    pathname.startsWith("/account/settings/")
  );
}

function isYoungPath(pathname: string) {
  return (
    pathname === "/catalog/young-events" ||
    pathname.startsWith("/catalog/young-events/")
  );
}

function isActiveLink(link: ShellLink) {
  return isShellLinkActive(link, $page.url);
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

async function resolveClientShell(
  navigationType: ClientShellNavigationType = "mount",
) {
  const serverNavigation = workspaceNavigationFromPageData(
    $page.data,
    viewerUser?.id,
  );
  if (serverNavigation) workspaceNavigation = serverNavigation;
  if (
    !shouldRequestClientShellBootstrap({
      navigationType,
      navigationUserId: workspaceNavigation?.userId,
      resolveViewerOnClient: data.resolveViewerOnClient,
      shellResolved,
      viewerUserId: viewerUser?.id,
    })
  ) {
    return;
  }

  cancelShellBootstrap();
  const controller = new AbortController();
  shellBootstrapAbortController = controller;
  const generation = shellBootstrapGeneration;
  // Keep known viewers ready during refresh, including SSR-resolved anonymous users.
  if (viewerFailed) viewerLoading = true;

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
    shellResolved =
      !bootstrap.viewer || bootstrap.navigation?.userId === bootstrap.viewer.id;
    viewerLoading = false;
    viewerFailed = false;
    if (
      shouldRedirectIncompleteProfileToWelcome({
        pathname: $page.url.pathname,
        url: new URL($page.url.href),
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
    viewerFailed = !viewerUser;
    viewerLoading = false;
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

afterNavigate(({ from, to, type, shallow }) => {
  if (shallow && type === "goto") return;
  if (!from || !to) return;
  void resolveClientShell(type);
  if (
    from.url.pathname === to.url.pathname &&
    from.url.search === to.url.search
  ) {
    return;
  }
  resetContentScroll();
});
</script>


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
      closeMenus={closeMenus}
      copy={data.copy}
      focused
      globalSearchShortcutLabel={globalSearchShortcutLabel}
      locale={data.locale}
      localeMenuOpen={localeMenuOpen}
      onOpenGlobalSearch={openGlobalSearch}
      setLocale={setLocale}
      setLocaleMenuOpen={setLocaleMenuOpen}
      setThemeMenuOpen={setThemeMenuOpen}
      setThemeMode={setThemeMode}
      themeMenuOpen={themeMenuOpen}
      themeMode={themeMode}
      signedIn={Boolean(viewerUser)}
      user={viewerUser}
      viewerLoading={viewerLoading}
    />

    <!-- svelte-ignore a11y_no_noninteractive_tabindex -- skip-link target -->
    <main
      aria-label={mainContentLabel}
      bind:this={contentScrollContainer}
      class="flex min-w-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-5 lg:px-6"
      data-shell-scroll-container
      id="main-content"
      tabindex={-1}
    ><slot></slot></main>
  </div>
{:else}
  <Sidebar.Provider
    bind:open={sidebarOpen}
    class="flex min-h-screen flex-col lg:h-screen lg:min-h-0 lg:overflow-hidden"
  >
    <div class="flex min-h-0 w-full flex-1">
      <AppSidebar
        avatarFallback={avatarFallback}
        closeMenus={closeMenus}
        copy={data.copy}
        currentPathname={$page.url.pathname}
        dockAboveFooter={showFooter}
        footerLinks={showFooter ? [] : footerLinks}
        sectionSidebar={sectionSidebar}
        isActiveLink={isActiveLink}
        navGroups={navGroups}
        profileHref={profileHref}
        setUserMenuOpen={setUserMenuOpen}
        showAccountFooter={!showFooter}
        user={viewerUser}
        userMenuOpen={userMenuOpen}
        viewerLoading={viewerLoading}
      />

      <Sidebar.Inset
        aria-label={mainContentLabel}
        id="main-content"
        tabindex={-1}
        class="relative flex w-full min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-hidden"
      >
        <AppTopbar
          closeMenus={closeMenus}
          copy={data.copy}
          globalSearchShortcutLabel={globalSearchShortcutLabel}
          locale={data.locale}
          localeMenuOpen={localeMenuOpen}
          onOpenGlobalSearch={openGlobalSearch}
          setLocale={setLocale}
          setLocaleMenuOpen={setLocaleMenuOpen}
          setThemeMenuOpen={setThemeMenuOpen}
          setThemeMode={setThemeMode}
          themeMenuOpen={themeMenuOpen}
          themeMode={themeMode}
          signedIn={Boolean(viewerUser)}
          user={viewerUser}
          viewerLoading={viewerLoading}
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
              youngEventBanner
              ? "p-0"
              : detailWorkspace
                ? "bg-card p-0 lg:min-h-0 lg:overflow-hidden"
                : "px-4 py-4 sm:px-5 lg:px-6",
              !showFooter && !detailWorkspace && "pb-[max(1rem,env(safe-area-inset-bottom))] lg:pb-4")}
          ><slot></slot></div>
        </div>
      </Sidebar.Inset>
    </div>

    {#if showFooter}
      <AppFooter
        avatarFallback={avatarFallback}
        closeMenus={closeMenus}
        copy={data.copy}
        currentPathname={$page.url.pathname}
        footerLinks={footerLinks}
        profileHref={profileHref}
        setUserMenuOpen={setUserMenuOpen}
        user={viewerUser}
        userMenuOpen={userMenuOpen}
        viewerLoading={viewerLoading}
      />
    {/if}

    {#if GlobalSearchDialog}
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
  </Sidebar.Provider>
{/if}

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
