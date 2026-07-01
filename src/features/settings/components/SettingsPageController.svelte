<script lang="ts">
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
import CircleUserRound from "$lib/components/icons/circle-user-round.svelte";
import FileText from "$lib/components/icons/file-text.svelte";
import Link2 from "$lib/components/icons/link-2.svelte";
import ShieldAlert from "$lib/components/icons/shield-alert.svelte";
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

  <nav
    aria-label={data.settingsNav.title}
    class="grid gap-2 rounded-md border border-base-300 bg-base-100 p-2 shadow-sm sm:grid-cols-2 xl:grid-cols-4"
  >
    {#each data.settingsNav.tabs as item}
      {@const Icon = tabIcon(item.icon)}
      <a
        aria-current={data.activeTab === item.id ? "page" : undefined}
        class={cn(
          "group grid grid-cols-[auto_1fr] gap-3 rounded-md border p-3 text-left transition-colors",
          data.activeTab === item.id
            ? "border-primary/40 bg-primary/5 text-base-content shadow-sm"
            : "border-transparent text-base-content/70 hover:border-base-300 hover:bg-base-200/60 hover:text-base-content",
          item.id === "danger" && data.activeTab !== item.id
            ? "hover:border-error/30 hover:bg-error/5"
            : "",
        )}
        href={item.href}
      >
        <span
          class={cn(
            "mt-0.5 inline-flex size-8 items-center justify-center rounded-md border",
            item.id === "danger"
              ? "border-error/30 bg-error/10 text-error"
              : data.activeTab === item.id
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-base-300 bg-base-100 text-base-content/60 group-hover:text-base-content",
          )}
        >
          <Icon />
        </span>
        <span class="min-w-0">
          <span class="block font-medium text-sm">{item.title}</span>
          <span class="mt-1 block text-xs leading-5 text-base-content/60">
            {item.description}
          </span>
        </span>
      </a>
    {/each}
  </nav>

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
</section>
