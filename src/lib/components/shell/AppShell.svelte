<script lang="ts">
import BookOpenIcon from "@lucide/svelte/icons/book-open";
import BusIcon from "@lucide/svelte/icons/bus";
import BusFrontIcon from "@lucide/svelte/icons/bus-front";
import GavelIcon from "@lucide/svelte/icons/gavel";
import KeyIcon from "@lucide/svelte/icons/key";
import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
import LinkIcon from "@lucide/svelte/icons/link";
import MapIcon from "@lucide/svelte/icons/map";
import RouteIcon from "@lucide/svelte/icons/route";
import ShieldIcon from "@lucide/svelte/icons/shield";
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
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import { setClientLocale } from "$lib/locale/client-locale";
import type {
  LayoutCopy,
  LayoutUserSummary,
} from "$lib/shell/layout-server-data";
import { cn } from "$lib/utils.js";
import {
  buildDetailSecondaryLinks,
  buildSubscriptionSecondaryLinks,
} from "./shell-nav-helpers";
import type { ShellLink, ShellNavGroup } from "./types";

type AppShellData = {
  copy: LayoutCopy;
  locale: "en-us" | "zh-cn";
  user: LayoutUserSummary;
};

export let data: AppShellData;

let themeMode: ThemeMode = "system";
let userMenuOpen = false;
let localeMenuOpen = false;
let themeMenuOpen = false;
let contentScrollContainer: HTMLDivElement | undefined;

$: profileHref = resolveProfileHref(data.user);
$: avatarFallback = resolveAvatarFallback(data.user);
$: navGroups = buildShellNavGroups(
  data.copy,
  Boolean(data.user),
  data.user?.isAdmin ?? false,
  $page.url.pathname,
  $page.data,
);
$: detailWorkspace = isDetailWorkspacePath($page.url.pathname);
const footerLinks = buildFooterLinks(data.copy.footer);

function isDetailWorkspacePath(pathname: string) {
  return /^\/(courses|sections|teachers)\/[^/]+/.test(pathname);
}

function buildShellNavGroups(
  copy: LayoutCopy,
  signedIn: boolean,
  isAdmin: boolean,
  pathname: string,
  pageData: Record<string, unknown>,
): ShellNavGroup[] {
  const detailSecondaryLinks = buildDetailSecondaryLinks(pathname, pageData);
  const catalogLinks: ShellLink[] = [
    {
      href: "/courses",
      icon: BookOpenIcon,
      label: copy.nav.courses,
      items: pathname.startsWith("/courses/")
        ? detailSecondaryLinks
        : undefined,
    },
    {
      href: "/sections",
      icon: RouteIcon,
      label: copy.nav.sections,
      items: pathname.startsWith("/sections/")
        ? detailSecondaryLinks
        : undefined,
    },
    {
      href: "/teachers",
      icon: UsersIcon,
      label: copy.nav.teachers,
      items: pathname.startsWith("/teachers/")
        ? detailSecondaryLinks
        : undefined,
    },
  ];
  const campusLinks: ShellLink[] = [
    { href: "/bus-map", icon: MapIcon, label: copy.nav.transitMap },
    { href: "/mobile-app", icon: SmartphoneIcon, label: copy.nav.mobileApp },
  ];
  const disambiguateDashboardBus = pathname.startsWith("/admin");
  const subscriptionSecondaryLinks = buildSubscriptionSecondaryLinks(pageData);
  const dashboardNavStats = pageData.navStats as
    | {
        calendarItemsCount?: number;
        examsCount?: number;
        pendingHomeworksCount?: number;
        pendingTodosCount?: number;
      }
    | null
    | undefined;
  const dashboardSubscribedSectionCount = pageData.subscribedSectionCount as
    | number
    | null
    | undefined;

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

  const adminLinks: ShellLink[] = [
    { href: "/admin", icon: ShieldIcon, label: copy.nav.admin.title },
    { href: "/admin/users", icon: UsersIcon, label: copy.nav.admin.users },
    {
      href: "/admin/moderation",
      icon: GavelIcon,
      label: copy.nav.admin.moderation,
    },
    { href: "/admin/oauth", icon: KeyIcon, label: copy.nav.admin.oauth },
    { href: "/admin/bus", icon: BusIcon, label: copy.nav.admin.bus },
  ];

  return [
    ...(isAdmin
      ? [{ label: copy.nav.groups.adminTools, links: adminLinks }]
      : []),
    {
      label: copy.nav.groups.workspace,
      links: [
        {
          href: "/dashboard",
          icon: LayoutDashboardIcon,
          items: [
            {
              ariaLabel: copy.nav.workspaceOverview,
              href: "/dashboard/overview",
              label: copy.nav.overview,
            },
            {
              ariaLabel: copy.nav.workspaceCalendar,
              badge: dashboardNavStats?.calendarItemsCount,
              href: "/dashboard/calendar",
              label: copy.nav.calendar,
            },
            {
              ariaLabel: copy.nav.workspaceHomeworks,
              badge: dashboardNavStats?.pendingHomeworksCount,
              href: "/dashboard/homeworks",
              label: copy.nav.homeworks,
            },
            {
              ariaLabel: copy.nav.workspaceTodos,
              badge: dashboardNavStats?.pendingTodosCount,
              href: "/dashboard/todos",
              label: copy.nav.todos,
            },
            {
              ariaLabel: copy.nav.workspaceExams,
              badge: dashboardNavStats?.examsCount,
              href: "/dashboard/exams",
              label: copy.nav.exams,
            },
            {
              ariaLabel: copy.nav.workspaceSubscriptions,
              badge: dashboardSubscribedSectionCount,
              href: "/dashboard/subscriptions",
              label: copy.nav.subscriptions,
              items:
                pathname === "/dashboard/subscriptions" ||
                pathname === "/dashboard/exams"
                  ? subscriptionSecondaryLinks
                  : undefined,
            },
          ],
          label: copy.nav.dashboard,
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
    if (pathname === "/dashboard" || pathname === "/dashboard/overview") {
      return true;
    }
    // Signed-in fallback to overview on the home route (e.g. /?tab=comments)
    if (pathname === "/" && data.user) {
      const tab = $page.url.searchParams.get("tab");
      return tab !== "bus" && tab !== "links";
    }
    return false;
  }
  if (target.pathname.startsWith("/dashboard/")) {
    return pathname === target.pathname;
  }
  if (["/courses", "/sections", "/teachers"].includes(target.pathname)) {
    return (
      pathname === target.pathname || pathname.startsWith(`${target.pathname}/`)
    );
  }
  if (target.pathname === "/admin") {
    return pathname === "/admin" || pathname.startsWith("/admin/");
  }
  return pathname === target.pathname;
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

async function setLocale(locale: "en-us" | "zh-cn") {
  await setClientLocale({
    currentLocale: data.locale,
    locale,
    onBeforeRequest: closeMenus,
  });
}

onMount(() => {
  themeMode = loadStoredThemeMode(themeMode);
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

<div style="--sidebar-width: 15rem; --sidebar-width-icon: 4rem;">
  <Sidebar.Provider
    class="min-h-screen lg:h-screen lg:min-h-0 lg:overflow-hidden"
  >
    {#if $navigating}
      <RouteLoadingBar loadingLabel={data.copy.shell.loading} />
    {/if}

    <AppSidebar
      copy={data.copy}
      {isActiveLink}
      {navGroups}
    />

    <Sidebar.Inset
      id="main-content"
      class="relative flex w-full min-w-0 flex-1 flex-col lg:h-screen lg:min-h-0 lg:overflow-hidden"
    >
      <AppTopbar
        {avatarFallback}
        {closeMenus}
        copy={data.copy}
        locale={data.locale}
        {localeMenuOpen}
        {profileHref}
        {setLocale}
        {setLocaleMenuOpen}
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
        data-shell-scroll-container
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

        {#if !detailWorkspace}
          <AppFooter
            copy={data.copy}
            {footerLinks}
          />
        {/if}
      </div>
    </Sidebar.Inset>
  </Sidebar.Provider>
</div>
