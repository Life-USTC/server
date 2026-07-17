<script lang="ts">
import CircleUserRound from "@lucide/svelte/icons/circle-user-round";
import FileText from "@lucide/svelte/icons/file-text";
import Link2 from "@lucide/svelte/icons/link-2";
import ShieldAlert from "@lucide/svelte/icons/shield-alert";
import { onMount } from "svelte";
import SettingsAccountsTab from "@/features/settings/components/SettingsAccountsTab.svelte";
import SettingsContentTab from "@/features/settings/components/SettingsContentTab.svelte";
import SettingsDangerTab from "@/features/settings/components/SettingsDangerTab.svelte";
import SettingsHeader from "@/features/settings/components/SettingsHeader.svelte";
import SettingsProfileTab from "@/features/settings/components/SettingsProfileTab.svelte";
import SettingsStatusAlert from "@/features/settings/components/SettingsStatusAlert.svelte";
import { createSettingsControllerDefaultState } from "@/features/settings/lib/settings-controller-default-state";
import {
  createDeleteAccountAction,
  createSettingsAccountAction,
} from "@/features/settings/lib/settings-page-actions";
import { cn } from "$lib/utils";
import type {
  SettingsAccount,
  SettingsCopy,
  SettingsUser,
} from "./settings-component-types";

type PageData = {
  activeTab: "accounts" | "content" | "danger" | "profile";
  accounts: SettingsAccount[];
  copy: SettingsCopy;
  message?: string | null;
  settingsNav: {
    title: string;
    tabs: Array<{
      description: string;
      href: string;
      icon: string;
      id: "accounts" | "content" | "danger" | "profile";
      title: string;
    }>;
  };
  tab: "accounts" | "content" | "danger" | "profile";
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
$: _unlinkAccount =
  data.accounts.find((account) => account.id === _unlinkAccountId) ?? null;
$: _hasPendingAccountAction = Boolean(_pendingAccountAction);
$: copy = data.copy;
$: activeNavItem =
  data.settingsNav.tabs.find((item) => item.id === data.activeTab) ??
  data.settingsNav.tabs[0];

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
  if (icon === "accounts") return Link2;
  if (icon === "content") return FileText;
  if (icon === "danger") return ShieldAlert;
  return CircleUserRound;
}

onMount(() => {
  _isMounted = true;
});
</script>

<svelte:head><title>{copy.settings.title} - Life@USTC</title></svelte:head>

<section class="grid gap-6">
  <SettingsHeader {copy} />

  <div class="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-6">
    <nav
      aria-label={data.settingsNav.title}
      class="-mx-4 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5 lg:sticky lg:top-4 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0"
      data-settings-navigation
    >
      <ul class="flex min-w-max gap-2 lg:grid lg:min-w-0">
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
            >
              <Icon aria-hidden="true" class="size-4 shrink-0" />
              <span>{item.title}</span>
            </a>
          </li>
        {/each}
      </ul>
    </nav>

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
