<script lang="ts">
import BookOpenIcon from "@lucide/svelte/icons/book-open";
import BusFrontIcon from "@lucide/svelte/icons/bus-front";
import CalendarDaysIcon from "@lucide/svelte/icons/calendar-days";
import ClipboardListIcon from "@lucide/svelte/icons/clipboard-list";
import GraduationCapIcon from "@lucide/svelte/icons/graduation-cap";
import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
import LinkIcon from "@lucide/svelte/icons/link";
import ListTodoIcon from "@lucide/svelte/icons/list-todo";
import MapIcon from "@lucide/svelte/icons/map";
import RouteIcon from "@lucide/svelte/icons/route";
import SmartphoneIcon from "@lucide/svelte/icons/smartphone";
import UsersIcon from "@lucide/svelte/icons/users";
import { onMount } from "svelte";
import { afterNavigate } from "$app/navigation";
import { navigating, page } from "$app/stores";
import AppFooter from "$lib/components/shell/AppFooter.svelte";
import AppSidebar from "$lib/components/shell/AppSidebar.svelte";
import AppTopbar from "$lib/components/shell/AppTopbar.svelte";
import {
  loadStoredThemeMode,
  setStoredThemeMode,
} from "$lib/components/shell/app-shell-actions";
import {
  applyShellTheme,
  buildFooterLinks,
  resolveAvatarFallback,
  resolveProfileHref,
  type ThemeMode,
} from "$lib/components/shell/layout-shell";
import RouteLoadingBar from "$lib/components/shell/RouteLoadingBar.svelte";
import {
  loadPrimarySidebarCollapsed,
  setPrimarySidebarCollapsed,
} from "$lib/components/sidebar-collapse";
import { setClientLocale } from "$lib/locale/client-locale";
import type {
  LayoutCopy,
  LayoutUserSummary,
} from "$lib/shell/layout-server-data";
import { cn } from "$lib/utils.js";
import type { ShellLink, ShellNavGroup } from "./types";

type AppShellData = {
  copy: LayoutCopy;
  locale: "en-us" | "zh-cn";
  user: LayoutUserSummary;
};

export let data: AppShellData;

let themeMode: ThemeMode = "system";
let mobileMenuOpen = false;
let userMenuOpen = false;
let localeMenuOpen = false;
let themeMenuOpen = false;
let primarySidebarCollapsed = false;
let contentScrollContainer: HTMLDivElement | undefined;

$: profileHref = resolveProfileHref(data.user);
$: avatarFallback = resolveAvatarFallback(data.user);
$: navGroups = buildShellNavGroups(
  data.copy,
  Boolean(data.user),
  $page.url.pathname,
);
$: detailWorkspace = isDetailWorkspacePath($page.url.pathname);
const footerLinks = buildFooterLinks(data.copy.footer);

function isDetailWorkspacePath(pathname: string) {
  return /^\/(courses|sections|teachers)\/[^/]+/.test(pathname);
}

function buildShellNavGroups(
  copy: LayoutCopy,
  signedIn: boolean,
  pathname: string,
): ShellNavGroup[] {
  const catalogLinks: ShellLink[] = [
    { href: "/courses", icon: BookOpenIcon, label: copy.nav.courses },
    { href: "/sections", icon: RouteIcon, label: copy.nav.sections },
    { href: "/teachers", icon: UsersIcon, label: copy.nav.teachers },
  ];
  const campusLinks: ShellLink[] = [
    { href: "/bus-map", icon: MapIcon, label: copy.nav.transitMap },
    { href: "/mobile-app", icon: SmartphoneIcon, label: copy.nav.mobileApp },
  ];
  const disambiguateDashboardBus = pathname.startsWith("/admin");

  if (!signedIn) {
    return [
      {
        label: copy.nav.groups.publicTools,
        links: [
          { href: "/?tab=bus", icon: BusFrontIcon, label: copy.nav.bus },
          { href: "/?tab=links", icon: LinkIcon, label: copy.nav.links },
        ],
      },
      { label: copy.nav.groups.catalog, links: catalogLinks },
      { label: copy.nav.groups.campus, links: campusLinks },
    ];
  }

  return [
    {
      label: copy.nav.groups.workspace,
      links: [
        {
          ariaLabel: copy.nav.workspaceOverview,
          href: "/dashboard/overview",
          icon: LayoutDashboardIcon,
          label: copy.nav.overview,
        },
        {
          ariaLabel: copy.nav.workspaceCalendar,
          href: "/dashboard/calendar",
          icon: CalendarDaysIcon,
          label: copy.nav.calendar,
        },
        {
          ariaLabel: copy.nav.workspaceHomeworks,
          href: "/dashboard/homeworks",
          icon: ClipboardListIcon,
          label: copy.nav.homeworks,
        },
        {
          ariaLabel: copy.nav.workspaceTodos,
          href: "/dashboard/todos",
          icon: ListTodoIcon,
          label: copy.nav.todos,
        },
        {
          ariaLabel: copy.nav.workspaceExams,
          href: "/dashboard/exams",
          icon: GraduationCapIcon,
          label: copy.nav.exams,
        },
        {
          ariaLabel: copy.nav.workspaceSubscriptions,
          href: "/dashboard/subscriptions",
          icon: RouteIcon,
          label: copy.nav.subscriptions,
        },
      ],
    },
    {
      label: copy.nav.groups.publicTools,
      links: [
        {
          ariaLabel: disambiguateDashboardBus
            ? copy.nav.dashboardBus
            : copy.nav.workspaceTransit,
          href: "/dashboard/bus",
          icon: BusFrontIcon,
          label: copy.nav.bus,
        },
        {
          ariaLabel: copy.nav.workspaceWebsites,
          href: "/dashboard/links",
          icon: LinkIcon,
          label: copy.nav.links,
        },
      ],
    },
    { label: copy.nav.groups.catalog, links: catalogLinks },
    { label: copy.nav.groups.campus, links: campusLinks },
  ];
}

function isActiveLink(link: ShellLink) {
  if (!link.href.startsWith("/")) return false;
  const target = new URL(link.href, $page.url.origin);
  const pathname = $page.url.pathname;

  if (link.href === "/?tab=bus") {
    return pathname === "/" && $page.url.searchParams.get("tab") !== "links";
  }
  if (link.href === "/?tab=links") {
    return pathname === "/" && $page.url.searchParams.get("tab") === "links";
  }
  if (target.pathname === "/dashboard/overview") {
    return pathname === "/dashboard" || pathname === "/dashboard/overview";
  }
  if (target.pathname.startsWith("/dashboard/")) {
    return pathname === target.pathname;
  }
  if (["/courses", "/sections", "/teachers"].includes(target.pathname)) {
    return (
      pathname === target.pathname || pathname.startsWith(`${target.pathname}/`)
    );
  }
  return pathname === target.pathname;
}

function setThemeMode(nextThemeMode: ThemeMode) {
  themeMode = setStoredThemeMode(nextThemeMode);
  themeMenuOpen = false;
}

function setPrimarySidebarOpen(collapsed: boolean) {
  primarySidebarCollapsed = setPrimarySidebarCollapsed(collapsed);
}

function setMobileMenuOpen(open: boolean) {
  mobileMenuOpen = open;
  if (open) {
    userMenuOpen = false;
    localeMenuOpen = false;
    themeMenuOpen = false;
  }
}

function setUserMenuOpen(open: boolean) {
  userMenuOpen = open;
  if (open) {
    mobileMenuOpen = false;
    localeMenuOpen = false;
    themeMenuOpen = false;
  }
}

function setLocaleMenuOpen(open: boolean) {
  localeMenuOpen = open;
  if (open) {
    mobileMenuOpen = false;
    userMenuOpen = false;
    themeMenuOpen = false;
  }
}

function setThemeMenuOpen(open: boolean) {
  themeMenuOpen = open;
  if (open) {
    mobileMenuOpen = false;
    userMenuOpen = false;
    localeMenuOpen = false;
  }
}

function closeMenus() {
  mobileMenuOpen = false;
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

async function setLocale(locale: "en-us" | "zh-cn") {
  await setClientLocale({
    currentLocale: data.locale,
    locale,
    onBeforeRequest: closeMenus,
  });
}

onMount(() => {
  themeMode = loadStoredThemeMode(themeMode);
  primarySidebarCollapsed = loadPrimarySidebarCollapsed(
    primarySidebarCollapsed,
  );
  applyShellTheme(themeMode);
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

<div
  class={cn(
    "min-h-screen bg-base-200 text-base-content transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none lg:grid lg:h-screen lg:min-h-0 lg:overflow-hidden",
    primarySidebarCollapsed
      ? "lg:grid-cols-[4rem_minmax(0,1fr)]"
      : "lg:grid-cols-[15rem_minmax(0,1fr)]",
  )}
>
  {#if $navigating}
    <RouteLoadingBar loadingLabel={data.copy.shell.loading} />
  {/if}

  <AppSidebar
    collapsed={primarySidebarCollapsed}
    copy={data.copy}
    {isActiveLink}
    {navGroups}
    setCollapsed={setPrimarySidebarOpen}
  />

  <div class="flex min-w-0 flex-col lg:h-screen lg:min-h-0 lg:overflow-hidden">
    <AppTopbar
      {avatarFallback}
      {closeMenus}
      copy={data.copy}
      {isActiveLink}
      locale={data.locale}
      {localeMenuOpen}
      {mobileMenuOpen}
      {navGroups}
      {profileHref}
      {setLocale}
      {setLocaleMenuOpen}
      {setMobileMenuOpen}
      {setThemeMenuOpen}
      {setThemeMode}
      {setUserMenuOpen}
      {themeMenuOpen}
      {themeMode}
      user={data.user}
      {userMenuOpen}
    />

    <div
      bind:this={contentScrollContainer}
      class={cn(
        "flex min-w-0 flex-1 flex-col",
        detailWorkspace
          ? "lg:min-h-0 lg:overflow-hidden"
          : "lg:min-h-0 lg:overflow-y-auto",
      )}
    >
      <main
        id="main-content"
        class={cn(
          "w-full flex-1",
          detailWorkspace
            ? "bg-base-100 p-0 lg:min-h-0 lg:overflow-hidden"
            : "px-4 py-4 sm:px-5 lg:px-6",
        )}
      >
        <slot />
      </main>

      {#if !detailWorkspace}
        <AppFooter
          copy={data.copy}
          {footerLinks}
        />
      {/if}
    </div>
  </div>
</div>
