<script lang="ts">
import { onMount, setContext, untrack } from "svelte";
import { writable } from "svelte/store";
import { shouldRedirectIncompleteProfileToWelcome } from "#lib/auth/auth-routing.js";
import {
  isApplePlatform,
  isGlobalSearchShortcut,
} from "#lib/browser/page-search-shortcut.js";
import AppFooter from "#lib/components/shell/AppFooter.svelte";
import AppSidebar from "#lib/components/shell/AppSidebar.svelte";
import AppTopbar from "#lib/components/shell/AppTopbar.svelte";
import {
  loadStoredThemeMode,
  SHELL_THEME_CHANGE_EVENT,
  setStoredThemeMode,
} from "#lib/components/shell/app-shell-actions.js";
import {
  applyShellTheme,
  buildFooterLinks,
  isSignInPath,
  resolveAvatarFallback,
  resolveProfileHref,
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
  demoNavigationLink,
  isDemoNavigationDestination,
} from "@/features/demo/lib/demo-navigation";
import type { DemoView } from "@/features/demo/lib/demo-types";
import { afterNavigate, goto } from "$app/navigation";
import { navigating, page as routePage } from "$app/state";
import MobilePrimaryNavigation from "./MobilePrimaryNavigation.svelte";
import {
  buildShellNavGroups,
  isShellLinkActive,
  isShellLinkAncestor,
} from "./navigation";
import { buildNavigationScopes } from "./navigation-scopes";
import ShellDetailNavigation from "./ShellDetailNavigation.svelte";
import { shellPresentation } from "./shell-templates";
import {
  loadSidebarPreferences,
  saveSidebarPreferences,
} from "./sidebar-preferences";
import type { ShellLink } from "./types";

if (typeof window !== "undefined") {
  const originalFetch = window.fetch.bind(window);
  let navigationCache:
    | Promise<typeof import("#lib/shell/public-navigation-cache.js")>
    | undefined;
  window.addEventListener("pagehide", () => {
    void navigationCache?.then(({ clearPublicNavigationCache }) =>
      clearPublicNavigationCache(),
    );
  });
  window.fetch = (input, init) => {
    const raw = input instanceof Request ? input.url : String(input);
    if (!raw.includes("__data.json") && !raw.includes("/sign-out")) {
      return originalFetch(input, init);
    }
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
  demo?: DemoView | null;
  copy: LayoutCopy;
  locale: "en-us" | "zh-cn";
  resolveViewerOnClient: boolean;
  user: LayoutUserSummary;
};

interface Props {
  data: AppShellData;
  children?: import("svelte").Snippet;
}

let { data, children }: Props = $props();

let themeMode: ThemeMode = $state("system");
let sidebarOpen = $state(true);
let globalSearchOpen = $state(false);
let GlobalSearchDialog:
  | typeof import("@/features/search/components/GlobalSearchDialog.svelte").default
  | null = $state(null);
let userMenuOpen = $state(false);
let completedNavigationGeneration = $state(0);
let localeMenuOpen = $state(false);
let themeMenuOpen = $state(false);
let contentScrollContainer: HTMLElement | undefined = $state();
let viewerLoading = $state(
  untrack(() => data.resolveViewerOnClient && !data.user && !data.demo),
);
let viewerUser = $state.raw(untrack(() => data.user));
let viewerDemo = $state.raw(untrack(() => data.demo ?? null));
let viewerOwnerId = $derived(
  viewerDemo ? `demo:${viewerDemo.fixtureVersion}` : viewerUser?.id,
);
let viewerFailed = $state(false);
const shellViewer = writable<ShellViewerState>(
  untrack(() => ({
    viewer: viewerUser,
    demo: viewerDemo,
    status: viewerLoading ? "loading" : "ready",
  })),
);
setContext(SHELL_VIEWER_CONTEXT, {
  ...shellViewer,
  retry: () => resolveClientShell("goto"),
});
let workspaceNavigation: WorkspaceNavigationSummary | null = $state.raw(
  untrack(() => workspaceNavigationFromPageData(routePage.data, viewerOwnerId)),
);
let shellBootstrapAbortController: AbortController | null = null;
let shellBootstrapGeneration = 0;
let shellMounted = false;
let globalSearchGeneration = 0;
let shellResolved = $state(false);

let footerLinks = $derived(
  buildFooterLinks(data.copy.footer).filter(
    (link) => !viewerDemo || isDemoNavigationDestination(link.href),
  ),
);

async function ensureGlobalSearchDialog() {
  return (
    GlobalSearchDialog ??
    (await import("@/features/search/components/GlobalSearchDialog.svelte"))
      .default
  );
}

function globalSearchOwner() {
  return JSON.stringify([
    viewerUser?.id,
    viewerDemo?.fixtureVersion,
    viewerDemo?.expiresAt,
    data.locale,
    routePage.url.pathname,
    shellBootstrapGeneration,
  ]);
}

async function openGlobalSearch() {
  const generation = ++globalSearchGeneration;
  const owner = globalSearchOwner();
  const component = await ensureGlobalSearchDialog();
  if (
    !shellMounted ||
    generation !== globalSearchGeneration ||
    owner !== globalSearchOwner() ||
    (viewerDemo && viewerDemo.expiresAt <= Date.now())
  )
    return;
  GlobalSearchDialog = component;
  globalSearchOpen = true;
}

async function handleGlobalSearchKeydown(event: KeyboardEvent) {
  if (
    shellPresentation(routePage.data.shellTemplate, Boolean(viewerUser)).focused
  )
    return;
  if (!isGlobalSearchShortcut(event)) return;
  event.preventDefault();
  await openGlobalSearch();
}

function resolveMainContentLabel(pageData: Record<string, unknown>) {
  const label = pageData.mainContentLabel;
  return typeof label === "string" && label.trim() ? label : undefined;
}

function isActiveLink(link: ShellLink) {
  return isShellLinkActive(link, routePage.url);
}

function isAncestorLink(link: ShellLink) {
  return isShellLinkAncestor(link, routePage.url);
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
    routePage.data,
    viewerOwnerId,
  );
  if (serverNavigation) {
    workspaceNavigation = serverNavigation;
    shellResolved = true;
  }
  // Home HTML has no viewer; returning home must resolve the current session.
  if (
    routePage.url.pathname !== "/" &&
    !shouldRequestClientShellBootstrap({
      navigationType,
      navigationUserId: serverNavigation?.userId,
      resolveViewerOnClient: data.resolveViewerOnClient,
      shellResolved,
      viewerUserId: viewerOwnerId,
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
    viewerDemo = bootstrap.demo ?? null;
    workspaceNavigation = bootstrap.navigation;
    shellResolved = viewerDemo
      ? bootstrap.navigation?.userId === `demo:${viewerDemo.fixtureVersion}`
      : !bootstrap.viewer ||
        bootstrap.navigation?.userId === bootstrap.viewer.id;
    viewerLoading = false;
    viewerFailed = false;
    if (
      shouldRedirectIncompleteProfileToWelcome({
        pathname: routePage.url.pathname,
        url: new URL(routePage.url.href),
        hasUser: Boolean(viewerUser?.id),
        hasCompleteProfile: Boolean(viewerUser?.name && viewerUser.username),
      })
    ) {
      const returnTo = `${routePage.url.pathname}${routePage.url.search}`;
      await goto(
        `/account/welcome?callbackUrl=${encodeURIComponent(returnTo)}`,
      );
    }
  } catch {
    if (controller.signal.aborted || generation !== shellBootstrapGeneration) {
      return;
    }
    viewerFailed = !viewerUser && !viewerDemo;
    viewerLoading = false;
    if (!viewerUser && !viewerDemo) workspaceNavigation = null;
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
  shellMounted = true;
  sidebarOpen =
    loadSidebarPreferences().open ??
    !window.matchMedia("(max-width: 1023px)").matches;
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
    shellMounted = false;
    globalSearchGeneration += 1;
    cancelShellBootstrap();
    window.removeEventListener("keydown", handleGlobalSearchKeydown);
    window.removeEventListener(SHELL_THEME_CHANGE_EVENT, syncThemeMode);
    systemTheme.removeEventListener("change", applySystemTheme);
  };
});

afterNavigate(({ from, to, type, shallow }) => {
  if (shallow && type === "goto") return;
  if (!from || !to) return;
  if (!shallow) completedNavigationGeneration += 1;
  globalSearchGeneration += 1;
  void resolveClientShell(type);
  if (
    from.url.pathname === to.url.pathname &&
    from.url.search === to.url.search
  ) {
    return;
  }
  resetContentScroll();
});
$effect.pre(() => {
  if (!data.resolveViewerOnClient || data.user || data.demo) {
    if (
      viewerUser?.id !== data.user?.id ||
      viewerDemo?.fixtureVersion !== data.demo?.fixtureVersion ||
      viewerDemo?.expiresAt !== data.demo?.expiresAt
    ) {
      cancelShellBootstrap();
      shellResolved = false;
      workspaceNavigation = null;
      globalSearchOpen = false;
      globalSearchGeneration += 1;
      closeMenus();
    }
    viewerUser = data.user;
    viewerDemo = data.demo ?? null;
    viewerLoading = false;
    viewerFailed = false;
  }
});
$effect.pre(() => {
  const snapshot: ShellViewerState = {
    viewer: viewerUser,
    demo: viewerDemo,
    status: viewerLoading ? "loading" : viewerFailed ? "error" : "ready",
  };
  untrack(() => shellViewer.set(snapshot));
});
let pageWorkspaceNavigation = $derived(
  workspaceNavigationFromPageData(routePage.data, viewerOwnerId),
);
$effect.pre(() => {
  if (pageWorkspaceNavigation) {
    workspaceNavigation = pageWorkspaceNavigation;
  }
});
$effect.pre(() => {
  if (
    workspaceNavigation &&
    viewerUser?.id &&
    routePage.data.userId === viewerUser.id &&
    Number.isSafeInteger(routePage.data.unreadActivityNotificationsCount) &&
    routePage.data.unreadActivityNotificationsCount >= 0 &&
    workspaceNavigation.unreadActivityNotificationsCount !==
      routePage.data.unreadActivityNotificationsCount
  ) {
    workspaceNavigation = {
      ...workspaceNavigation,
      unreadActivityNotificationsCount:
        routePage.data.unreadActivityNotificationsCount,
    };
  }
});
let profileHref = $derived(resolveProfileHref(viewerUser));
let avatarFallback = $derived(resolveAvatarFallback(viewerUser));
let demoNavigationExpired = $state(false);
$effect(() => {
  demoNavigationExpired = Boolean(
    viewerDemo && viewerDemo.expiresAt <= Date.now(),
  );
  if (!viewerDemo) return;
  const timer = setTimeout(
    () => {
      demoNavigationExpired = true;
    },
    Math.max(0, viewerDemo.expiresAt - Date.now()),
  );
  return () => clearTimeout(timer);
});
let navigationDemo = $derived(demoNavigationExpired ? null : viewerDemo);
let navViewer = $derived(
  viewerLoading || viewerFailed
    ? null
    : navigationDemo
      ? { signedIn: true, isAdmin: false }
      : viewerUser
        ? { signedIn: true, isAdmin: viewerUser.isAdmin }
        : null,
);
let navContext = $derived({
  pathname: routePage.url.pathname,
  pageData: routePage.data,
  navigation: workspaceNavigation,
});
function projectNavigation(groups: ReturnType<typeof buildShellNavGroups>) {
  return viewerDemo
    ? groups.map((group) => ({
        ...group,
        links: group.links.map((link) =>
          demoNavigationLink(link, viewerDemo?.unavailableReason ?? ""),
        ),
      }))
    : groups;
}
let scopedNavigation = $derived(
  buildNavigationScopes(data.copy, navViewer, navContext, viewerLoading),
);
let navigationScopes = $derived(
  Object.fromEntries(
    Object.entries(scopedNavigation.scopes).map(([key, scope]) => [
      key,
      { ...scope, groups: projectNavigation(scope.groups) },
    ]),
  ),
);
let primaryLinks = $derived(
  projectNavigation([
    {
      label: data.copy.shell.primaryNavigation,
      links: scopedNavigation.primary,
    },
  ])[0].links,
);
let navigationOwnerKey = $derived(
  JSON.stringify([
    completedNavigationGeneration,
    routePage.url.pathname,
    routePage.url.search,
    data.locale,
    viewerLoading,
    viewerFailed,
    demoNavigationExpired,
    viewerUser?.id ?? null,
    viewerUser?.isAdmin ?? false,
    viewerDemo?.fixtureVersion ?? null,
    viewerDemo?.expiresAt ?? null,
  ]),
);
let presentation = $derived(
  shellPresentation(routePage.data.shellTemplate, Boolean(viewerUser)),
);
let detailWorkspace = $derived(presentation.detailScroll);
let focusedShell = $derived(presentation.focused);
let hideSignIn = $derived(
  Boolean(viewerDemo) || isSignInPath(routePage.url.pathname),
);
let showFooter = $derived(presentation.footer === "public");
const homeHref = "/";
const homeLabel = $derived(
  viewerDemo
    ? data.copy.shell.discovery.demoHome
    : data.copy.shell.discovery.home,
);
let mainContentLabel = $derived(resolveMainContentLabel(routePage.data));
let globalSearchShortcutLabel = $derived(
  isApplePlatform()
    ? data.copy.globalSearch.shortcutMac
    : data.copy.globalSearch.shortcut,
);
</script>

<a
  class="sr-only top-3 left-3 z-50 rounded-md bg-background font-medium text-foreground shadow-lg outline-none focus:fixed focus:not-sr-only focus:px-4 focus:py-2 focus-visible:ring-2 focus-visible:ring-ring"
  href="#main-content"
>
  {data.copy.shell.skipToMainContent}
</a>

{#if navigating.to}
  <RouteLoadingBar loadingLabel={data.copy.shell.loading} />
{/if}

{#if focusedShell}
  <div class="flex min-h-screen flex-col" data-shell="focused">
    <AppTopbar
      {closeMenus}
      copy={data.copy}
      focused
      {globalSearchShortcutLabel}
      {homeHref}
      {homeLabel}
      {hideSignIn}
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
      {avatarFallback}
      {profileHref}
      {userMenuOpen}
      {setUserMenuOpen}
      currentPathname={routePage.url.pathname}
      demo={navigationDemo}
      {viewerLoading}
    />

    <!-- svelte-ignore a11y_no_noninteractive_tabindex -- skip_link target -->
    <main
      aria-label={mainContentLabel}
      bind:this={contentScrollContainer}
      class="flex min-w-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-5 lg:px-6"
      data-shell-scroll-container
      id="main-content"
      tabindex={-1}
    >
      {@render children?.()}
    </main>
  </div>
{:else}
  <Sidebar.Provider
    bind:open={sidebarOpen}
    onOpenChange={(open) =>
      saveSidebarPreferences({ ...loadSidebarPreferences(), open })}
    data-shell-detail-workspace={detailWorkspace ? "true" : undefined}
    class={cn(
      "flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:h-screen lg:min-h-0 lg:overflow-hidden lg:pb-0",
      detailWorkspace ? "h-dvh min-h-0 overflow-hidden" : "min-h-screen",
    )}
  >
    <div class="flex min-h-0 w-full flex-1">
      <AppSidebar
        dockAboveFooter={showFooter}
        copy={data.copy}
        currentPathname={routePage.url.pathname}
        footerLinks={presentation.footer === "sidebar" ? footerLinks : []}
        {homeHref}
        {homeLabel}
        {isActiveLink}
        {isAncestorLink}
        scopes={navigationScopes}
        currentScope={scopedNavigation.current}
        {navigationOwnerKey}
      />

      <Sidebar.Inset
        aria-label={mainContentLabel}
        id="main-content"
        tabindex={-1}
        class={cn(
          "relative flex w-full min-w-0 flex-1 flex-col",
          detailWorkspace
            ? "min-h-0 overflow-hidden"
            : "lg:min-h-0 lg:overflow-hidden",
        )}
      >
        <AppTopbar
          {closeMenus}
          copy={data.copy}
          {globalSearchShortcutLabel}
          {homeHref}
          {homeLabel}
          {hideSignIn}
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
          {avatarFallback}
          {profileHref}
          {userMenuOpen}
          {setUserMenuOpen}
          currentPathname={routePage.url.pathname}
          demo={navigationDemo}
          {viewerLoading}
        />

        <!-- svelte-ignore a11y_no_noninteractive_tabindex -- the desktop content region is the keyboard_scrollable viewport -->
        <div
          bind:this={contentScrollContainer}
          aria-label={data.copy.shell.scrollRegion}
          data-shell-scroll-container
          role="region"
          tabindex="0"
          class={cn(
            "flex min-w-0 flex-1 flex-col",
            detailWorkspace
              ? "min-h-0 overflow-hidden"
              : "lg:min-h-0 lg:overflow-y-auto",
          )}
        >
          {#if detailWorkspace}
            <ShellDetailNavigation
              pageData={routePage.data}
              pathname={routePage.url.pathname}
              hash={routePage.url.hash}
              viewerReady={!viewerLoading}
              copy={data.copy}
            />
          {/if}
          <div
            class={cn(
              "w-full flex-1",
              detailWorkspace
                ? "bg-card p-0 min-h-0 overflow-hidden"
                : presentation.edgeToEdge
                  ? "p-0"
                  : "px-4 py-4 sm:px-5 lg:px-6",
              !showFooter && !detailWorkspace && "pb-4",
            )}
          >
            {@render children?.()}
          </div>
        </div>
      </Sidebar.Inset>
    </div>

    {#if showFooter}
      <AppFooter copy={data.copy} {footerLinks} />
    {/if}

    <MobilePrimaryNavigation
      links={primaryLinks}
      pathname={routePage.url.pathname}
      label={data.copy.shell.primaryNavigation}
    />

    {#if GlobalSearchDialog}
      <GlobalSearchDialog
        copy={data.copy.globalSearch}
        locale={data.locale}
        bind:open={globalSearchOpen}
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
