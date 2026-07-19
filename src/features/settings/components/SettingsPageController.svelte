<script lang="ts">
import CircleUserRound from "@lucide/svelte/icons/circle-user-round";
import FileText from "@lucide/svelte/icons/file-text";
import KeyRound from "@lucide/svelte/icons/key-round";
import Link2 from "@lucide/svelte/icons/link-2";
import ShieldAlert from "@lucide/svelte/icons/shield-alert";
import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
import { onMount, tick } from "svelte";
import SettingsAccountsTab from "@/features/settings/components/SettingsAccountsTab.svelte";
import SettingsAuthorizationsTab from "@/features/settings/components/SettingsAuthorizationsTab.svelte";
import SettingsContentTab from "@/features/settings/components/SettingsContentTab.svelte";
import SettingsDangerTab from "@/features/settings/components/SettingsDangerTab.svelte";
import SettingsHeader from "@/features/settings/components/SettingsHeader.svelte";
import SettingsPreferencesTab from "@/features/settings/components/SettingsPreferencesTab.svelte";
import SettingsProfileTab from "@/features/settings/components/SettingsProfileTab.svelte";
import SettingsStatusAlert from "@/features/settings/components/SettingsStatusAlert.svelte";
import { createSettingsControllerDefaultState } from "@/features/settings/lib/settings-controller-default-state";
import {
  createDeleteAccountAction,
  createSettingsAccountAction,
} from "@/features/settings/lib/settings-page-actions";
import type { SettingsTab } from "@/features/settings/lib/settings-tabs";
import { cn } from "$lib/utils";
import type {
  SettingsAccount,
  SettingsCopy,
  SettingsOAuthAuthorization,
  SettingsUser,
} from "./settings-component-types";

type PageData = {
  activeTab: SettingsTab;
  accounts: SettingsAccount[];
  authorizations: SettingsOAuthAuthorization[];
  copy: SettingsCopy;
  locale: "en-us" | "zh-cn";
  message?: string | null;
  settingsNav: {
    title: string;
    tabs: Array<{
      description: string;
      href: string;
      icon: string;
      id: SettingsTab;
      title: string;
    }>;
  };
  tab: SettingsTab;
  user: SettingsUser & {
    image?: string | null;
    profilePictures: string[];
  };
};

type ActionData = {
  message?: string;
} | null;

export let data: PageData;
export let form: ActionData;

let {
  deleteConfirmValue: _deleteConfirmValue,
  isDeleteAccountOpen: _isDeleteAccountOpen,
  isDeletingAccount: _isDeletingAccount,
  isMounted: _isMounted,
  pendingAccountAction: _pendingAccountAction,
  selectedImage,
  unlinkAccountId: _unlinkAccountId,
} = createSettingsControllerDefaultState({
  userImage: data.user.image,
});
$: avatarOptions =
  data.user.profilePictures.length > 0 ? data.user.profilePictures : [];
$: currentImage = data.user.image ?? "";
$: previewImage = selectedImage || "/images/icon.png";
$: statusMessage = form?.message ?? data.message;
$: if (
  _unlinkAccountId &&
  !data.accounts.some(
    (account) => account.id === _unlinkAccountId && account.linked,
  )
) {
  _unlinkAccountId = null;
}
$: _unlinkAccount =
  data.accounts.find((account) => account.id === _unlinkAccountId) ?? null;
$: _hasPendingAccountAction = Boolean(_pendingAccountAction);
$: copy = data.copy;
$: activeNavItem =
  data.settingsNav.tabs.find((item) => item.id === data.activeTab) ??
  data.settingsNav.tabs[0];

let canScrollNavLeft = false;
let canScrollNavRight = false;
let settingsNavigation: HTMLElement | null = null;

const accountAction = createSettingsAccountAction({
  setPendingAccountAction: (value) => {
    _pendingAccountAction = value;
  },
});

const deleteAccountAction = createDeleteAccountAction({
  setDeletingAccount: (value) => {
    _isDeletingAccount = value;
  },
});

function tabIcon(icon: string) {
  if (icon === "preferences") return SlidersHorizontal;
  if (icon === "accounts") return Link2;
  if (icon === "authorizations") return KeyRound;
  if (icon === "content") return FileText;
  if (icon === "danger") return ShieldAlert;
  return CircleUserRound;
}

function revealActive(node: HTMLElement, active: boolean) {
  function reveal(isActive: boolean) {
    if (isActive) {
      void tick().then(() => {
        if (!settingsNavigation) return;
        const navigationBox = settingsNavigation.getBoundingClientRect();
        const nodeBox = node.getBoundingClientRect();
        settingsNavigation.scrollLeft +=
          nodeBox.left +
          nodeBox.width / 2 -
          (navigationBox.left + navigationBox.width / 2);
        updateNavigationOverflow();
      });
    }
  }

  reveal(active);
  return { update: reveal };
}

function updateNavigationOverflow() {
  if (!settingsNavigation) return;
  canScrollNavLeft = settingsNavigation.scrollLeft > 1;
  canScrollNavRight =
    settingsNavigation.scrollLeft + settingsNavigation.clientWidth <
    settingsNavigation.scrollWidth - 1;
}

onMount(() => {
  _isMounted = true;
  if (!settingsNavigation) return;
  const navigation = settingsNavigation;
  const resizeObserver = new ResizeObserver(updateNavigationOverflow);
  resizeObserver.observe(navigation);
  navigation.addEventListener("scroll", updateNavigationOverflow, {
    passive: true,
  });
  void tick().then(updateNavigationOverflow);

  return () => {
    resizeObserver.disconnect();
    navigation.removeEventListener("scroll", updateNavigationOverflow);
  };
});
</script>

<svelte:head><title>{copy.settings.title} - Life@USTC</title></svelte:head>

<section class="grid gap-6">
  <SettingsHeader {copy} />

  <div class="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-6">
    <div
      class={cn(
        "relative -mx-4 min-w-0 sm:-mx-5 lg:sticky lg:top-4 lg:mx-0",
        canScrollNavLeft &&
          "before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-8 before:bg-gradient-to-r before:from-background before:to-transparent lg:before:hidden",
        canScrollNavRight &&
          "after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:z-10 after:w-8 after:bg-gradient-to-l after:from-background after:to-transparent lg:after:hidden",
      )}
      data-overflow-left={canScrollNavLeft}
      data-overflow-right={canScrollNavRight}
    >
      <nav
        aria-label={data.settingsNav.title}
        bind:this={settingsNavigation}
        class="overflow-x-auto px-4 pb-1 sm:px-5 lg:overflow-visible lg:px-0 lg:pb-0"
        data-settings-navigation
      >
        <ul class="flex min-w-max gap-2 pr-8 lg:grid lg:min-w-0 lg:pr-0">
          {#each data.settingsNav.tabs as item}
            {@const Icon = tabIcon(item.icon)}
            {@const isActive = data.activeTab === item.id}
            <li class="lg:min-w-0">
              <a
                aria-current={isActive ? "page" : undefined}
                class={cn(
                  "flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 font-medium text-sm transition-colors lg:w-full lg:whitespace-normal",
                  isActive && item.id === "danger"
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : isActive
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : item.id === "danger"
                        ? "border-transparent text-destructive hover:border-destructive/30 hover:bg-destructive/5"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
                )}
                href={item.href}
                use:revealActive={isActive}
              >
                <Icon aria-hidden="true" class="size-4 shrink-0" />
                <span>{item.title}</span>
              </a>
            </li>
          {/each}
        </ul>
      </nav>
    </div>

    <div class="grid min-w-0 gap-4" data-settings-active-panel>
      {#if activeNavItem}
        <header class="grid gap-1" data-settings-active-header>
          <h2 class="font-semibold text-xl">{activeNavItem.title}</h2>
          <p class="text-muted-foreground text-sm">{activeNavItem.description}</p>
        </header>
      {/if}

      <SettingsStatusAlert {copy} {statusMessage} />

      {#if data.tab === "profile"}
        <SettingsProfileTab
          {avatarOptions}
          {copy}
          currentImage={currentImage}
          isMounted={_isMounted}
          previewImage={previewImage}
          bind:selectedImage
          user={data.user}
        />
      {:else if data.tab === "preferences"}
        <SettingsPreferencesTab {copy} locale={data.locale} />
      {:else if data.tab === "accounts"}
        <SettingsAccountsTab
          accountAction={accountAction}
          accounts={data.accounts}
          {copy}
          hasPendingAccountAction={_hasPendingAccountAction}
          isMounted={_isMounted}
          pendingAccountAction={_pendingAccountAction}
          unlinkAccount={_unlinkAccount}
          bind:unlinkAccountId={_unlinkAccountId}
          user={data.user}
        />
      {:else if data.tab === "authorizations"}
        <SettingsAuthorizationsTab
          authorizations={data.authorizations}
          {copy}
          locale={data.locale}
        />
      {:else if data.tab === "content"}
        <SettingsContentTab {copy} />
      {:else}
        <SettingsDangerTab
          {copy}
          {deleteAccountAction}
          bind:deleteConfirmValue={_deleteConfirmValue}
          bind:isDeleteAccountOpen={_isDeleteAccountOpen}
          isDeletingAccount={_isDeletingAccount}
          isMounted={_isMounted}
        />
      {/if}
    </div>
  </div>
</section>
