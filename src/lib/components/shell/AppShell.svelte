<script lang="ts">
import BookOpenIcon from "@lucide/svelte/icons/book-open";
import BusFrontIcon from "@lucide/svelte/icons/bus-front";
import CalendarDaysIcon from "@lucide/svelte/icons/calendar-days";
import ClipboardCheckIcon from "@lucide/svelte/icons/clipboard-check";
import CompassIcon from "@lucide/svelte/icons/compass";
import GraduationCapIcon from "@lucide/svelte/icons/graduation-cap";
import HouseIcon from "@lucide/svelte/icons/house";
import LinkIcon from "@lucide/svelte/icons/link";
import ListTodoIcon from "@lucide/svelte/icons/list-todo";
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
$: mobileNavGroups = data.user
  ? buildMobileSecondaryNavGroups(
      data.copy,
      data.user.isAdmin,
      $page.url.pathname,
      $page.data,
    )
  : navGroups;
$: mobilePrimaryLinks = buildMobilePrimaryLinks(data.copy);
$: mobileSecondaryHasActive =
  Boolean($page.url.pathname) &&
  mobileNavGroups.some((group) =>
    group.links.some((link) => linkHasActiveDestination(link)),
  );
$: detailWorkspace = isDetailWorkspacePath($page.url.pathname);
$: showFooter = shouldShowAppFooter($page.url.pathname, Boolean(data.user));
$: mainContentLabel = resolveMainContentLabel($page.data);
const footerLinks = buildFooterLinks(data.copy.footer);

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
        defaultOpen: true,
        label: copy.nav.groups.publicTools,
        links: [
          { href: "/bus", icon: BusFrontIcon, label: copy.nav.bus },
          { href: "/links", icon: LinkIcon, label: copy.nav.links },
        ],
      },
      {
        defaultOpen: true,
        label: copy.nav.groups.catalog,
        links: catalogLinks,
      },
      {
        defaultOpen: true,
        label: copy.nav.groups.campus,
        links: campusLinks,
      },
    ];
  }

  const adminLinks: ShellLink[] = [
    { href: "/admin", icon: ShieldIcon, label: copy.nav.admin.title },
  ];

  return [
    {
      defaultOpen: true,
      label: copy.nav.groups.workspace,
      links: [
        {
          ariaLabel: copy.nav.today,
          href: "/dashboard/overview",
          icon: HouseIcon,
          label: copy.nav.today,
        },
        {
          ariaLabel: copy.nav.calendar,
          badge: dashboardNavStats?.calendarItemsCount,
          href: "/dashboard/calendar",
          icon: CalendarDaysIcon,
          label: copy.nav.calendar,
        },
        {
          ariaLabel: copy.nav.homeworks,
          badge: dashboardNavStats?.pendingHomeworksCount,
          href: "/dashboard/homeworks",
          icon: BookOpenIcon,
          label: copy.nav.homeworks,
        },
        {
          ariaLabel: copy.nav.todos,
          badge: dashboardNavStats?.pendingTodosCount,
          href: "/dashboard/todos",
          icon: ListTodoIcon,
          label: copy.nav.todos,
        },
        {
          ariaLabel: copy.nav.exams,
          badge: dashboardNavStats?.examsCount,
          href: "/dashboard/exams",
          icon: GraduationCapIcon,
          label: copy.nav.exams,
        },
        {
          ariaLabel: copy.nav.subscriptions,
          badge: dashboardSubscribedSectionCount,
          href: "/dashboard/subscriptions",
          icon: RouteIcon,
          items:
            pathname === "/dashboard/subscriptions" ||
            pathname === "/dashboard/exams"
              ? subscriptionSecondaryLinks
              : undefined,
          label: copy.nav.subscriptions,
        },
      ],
    },
    {
      label: copy.nav.groups.explore,
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
          ariaLabel: copy.nav.links,
          href: "/dashboard/links",
          icon: LinkIcon,
          label: copy.nav.links,
        },
        ...catalogLinks,
        ...campusLinks,
      ],
    },
    ...(isAdmin
      ? [
          {
            defaultOpen: pathname.startsWith("/admin"),
            label: copy.nav.groups.adminTools,
            links: adminLinks,
          },
        ]
      : []),
  ];
}

function buildMobileSecondaryNavGroups(
  copy: LayoutCopy,
  isAdmin: boolean,
  pathname: string,
  pageData: Record<string, unknown>,
): ShellNavGroup[] {
  const detailSecondaryLinks = buildDetailSecondaryLinks(pathname, pageData);
  const subscriptionSecondaryLinks = buildSubscriptionSecondaryLinks(pageData);
  const dashboardNavStats = pageData.navStats as
    | {
        examsCount?: number;
        pendingTodosCount?: number;
      }
    | null
    | undefined;
  const dashboardSubscribedSectionCount = pageData.subscribedSectionCount as
    | number
    | null
    | undefined;
  const secondaryLinks: ShellLink[] = [
    {
      ariaLabel: copy.nav.todos,
      badge: dashboardNavStats?.pendingTodosCount,
      href: "/dashboard/todos",
      icon: ListTodoIcon,
      label: copy.nav.todos,
    },
    {
      ariaLabel: copy.nav.exams,
      badge: dashboardNavStats?.examsCount,
      href: "/dashboard/exams",
      icon: GraduationCapIcon,
      label: copy.nav.exams,
    },
    {
      ariaLabel: copy.nav.subscriptions,
      badge: dashboardSubscribedSectionCount,
      href: "/dashboard/subscriptions",
      icon: RouteIcon,
      items:
        pathname === "/dashboard/subscriptions" ||
        pathname === "/dashboard/exams"
          ? subscriptionSecondaryLinks
          : undefined,
      label: copy.nav.subscriptions,
    },
    {
      href: "/dashboard/bus",
      icon: BusFrontIcon,
      label: copy.nav.bus,
    },
    {
      href: "/dashboard/links",
      icon: LinkIcon,
      label: copy.nav.links,
    },
    {
      href: "/sections",
      icon: RouteIcon,
      items: pathname.startsWith("/sections/")
        ? detailSecondaryLinks
        : undefined,
      label: copy.nav.sections,
    },
    {
      href: "/teachers",
      icon: UsersIcon,
      items: pathname.startsWith("/teachers/")
        ? detailSecondaryLinks
        : undefined,
      label: copy.nav.teachers,
    },
    { href: "/bus-map", icon: MapIcon, label: copy.nav.transitMap },
    { href: "/mobile-app", icon: SmartphoneIcon, label: copy.nav.mobileApp },
  ];
  const adminLinks: ShellLink[] = [
    { href: "/admin", icon: ShieldIcon, label: copy.nav.admin.title },
  ];

  return [
    {
      defaultOpen: true,
      label: copy.nav.groups.secondary,
      links: secondaryLinks,
    },
    ...(isAdmin
      ? [
          {
            defaultOpen: pathname.startsWith("/admin"),
            label: copy.nav.groups.adminTools,
            links: adminLinks,
          },
        ]
      : []),
  ];
}

function buildMobilePrimaryLinks(copy: LayoutCopy): ShellLink[] {
  return [
    {
      href: "/dashboard/overview",
      icon: HouseIcon,
      label: copy.nav.today,
    },
    {
      href: "/dashboard/calendar",
      icon: CalendarDaysIcon,
      label: copy.nav.calendar,
    },
    {
      href: "/dashboard/homeworks",
      icon: ClipboardCheckIcon,
      label: copy.nav.tasks,
    },
    {
      href: "/courses",
      icon: CompassIcon,
      label: copy.nav.explore,
    },
  ];
}

function isActiveLink(link: ShellLink) {
  if (!link.href.startsWith("/")) return false;
  const target = new URL(link.href, $page.url.origin);
  const pathname = $page.url.pathname;

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
  if (target.pathname === "/settings/profile") {
    return pathname === "/settings" || pathname.startsWith("/settings/");
  }
  if (target.pathname === "/admin") {
    return pathname === "/admin" || pathname.startsWith("/admin/");
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

  if (link.href === "/dashboard/homeworks") {
    return [
      "/dashboard/homeworks",
      "/dashboard/todos",
      "/dashboard/exams",
      "/dashboard/subscriptions",
    ].includes(pathname);
  }
  if (link.href === "/courses") {
    return (
      [
        "/dashboard/bus",
        "/dashboard/links",
        "/bus-map",
        "/mobile-app",
      ].includes(pathname) ||
      ["/courses", "/sections", "/teachers"].some(
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
  document.documentElement.dataset.lifeUstcHydrated = "true";

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

<Sidebar.Provider
  class="min-h-screen lg:h-screen lg:min-h-0 lg:overflow-hidden"
>
    <a
      class="sr-only top-3 left-3 z-50 rounded-md bg-background px-4 py-2 font-medium text-foreground shadow-lg outline-none focus:fixed focus:not-sr-only focus-visible:ring-2 focus-visible:ring-ring"
      href="#main-content"
    >
      {data.copy.shell.skipToMainContent}
    </a>

    {#if $navigating}
      <RouteLoadingBar loadingLabel={data.copy.shell.loading} />
    {/if}

    <AppSidebar
      {avatarFallback}
      {closeMenus}
      copy={data.copy}
      currentPathname={$page.url.pathname}
      {isActiveLink}
      {mobileNavGroups}
      {navGroups}
      {profileHref}
      {setUserMenuOpen}
      user={data.user}
      {userMenuOpen}
    />

    <Sidebar.Inset
      aria-label={mainContentLabel}
      id="main-content"
      tabindex={-1}
      class={cn(
        "relative flex w-full min-w-0 flex-1 flex-col lg:h-screen lg:min-h-0 lg:overflow-hidden",
        data.user &&
          "pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0",
      )}
    >
      <AppTopbar
        {closeMenus}
        copy={data.copy}
        locale={data.locale}
        {localeMenuOpen}
        {setLocale}
        {setLocaleMenuOpen}
        {setThemeMenuOpen}
        {setThemeMode}
        {themeMenuOpen}
        {themeMode}
        user={data.user}
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

        {#if showFooter}
          <AppFooter
            copy={data.copy}
            {footerLinks}
          />
        {/if}
      </div>
    </Sidebar.Inset>

    {#if data.user}
      <MobilePrimaryNav
        copy={data.copy}
        hasSecondaryCurrent={mobileSecondaryHasActive}
        isActiveLink={isMobilePrimaryActive}
        links={mobilePrimaryLinks}
      />
    {/if}
</Sidebar.Provider>
