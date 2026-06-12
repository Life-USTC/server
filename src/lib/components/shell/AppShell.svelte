<script lang="ts">
import { onMount } from "svelte";
import { navigating } from "$app/stores";
import AppFooter from "$lib/components/shell/AppFooter.svelte";
import AppHeader from "$lib/components/shell/AppHeader.svelte";
import {
  cycleStoredThemeMode,
  loadStoredThemeMode,
  setShellLocale,
} from "$lib/components/shell/app-shell-actions";
import {
  applyShellTheme,
  buildFooterLinks,
  buildPrimaryLinks,
  resolveAvatarFallback,
  resolveProfileHref,
  resolveThemeButtonLabel,
  type ThemeMode,
} from "$lib/components/shell/layout-shell";
import RouteLoadingBar from "$lib/components/shell/RouteLoadingBar.svelte";
import type {
  LayoutCopy,
  LayoutUserSummary,
} from "$lib/shell/layout-server-data";

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

$: profileHref = resolveProfileHref(data.user);
$: avatarFallback = resolveAvatarFallback(data.user);
$: themeButtonLabel = resolveThemeButtonLabel(themeMode, data.copy.theme);

const primaryLinks = buildPrimaryLinks(data.copy.nav);
const footerLinks = buildFooterLinks(data.copy.footer);

function cycleTheme() {
  themeMode = cycleStoredThemeMode(themeMode);
}

function toggleMobileMenu() {
  mobileMenuOpen = !mobileMenuOpen;
  userMenuOpen = false;
  localeMenuOpen = false;
}

function toggleUserMenu() {
  userMenuOpen = !userMenuOpen;
  mobileMenuOpen = false;
  localeMenuOpen = false;
}

function toggleLocaleMenu() {
  localeMenuOpen = !localeMenuOpen;
  mobileMenuOpen = false;
  userMenuOpen = false;
}

function closeMenus() {
  mobileMenuOpen = false;
  userMenuOpen = false;
  localeMenuOpen = false;
}

async function setLocale(locale: "en-us" | "zh-cn") {
  await setShellLocale({
    currentLocale: data.locale,
    locale,
    onBeforeRequest: closeMenus,
  });
}

onMount(() => {
  themeMode = loadStoredThemeMode(themeMode);
  applyShellTheme(themeMode);
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

<div class="flex min-h-screen flex-col bg-base-200 text-base-content">
  {#if $navigating}
    <RouteLoadingBar loadingLabel={data.copy.shell.loading} />
  {/if}

  <AppHeader
    {avatarFallback}
    {closeMenus}
    copy={data.copy}
    {mobileMenuOpen}
    {primaryLinks}
    {profileHref}
    {toggleMobileMenu}
    {toggleUserMenu}
    user={data.user}
    {userMenuOpen}
  />

  <main id="main-content" class="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
    <slot />
  </main>

  <AppFooter
    copy={data.copy}
    {cycleTheme}
    {footerLinks}
    locale={data.locale}
    {localeMenuOpen}
    {setLocale}
    {themeButtonLabel}
    {toggleLocaleMenu}
  />
</div>
