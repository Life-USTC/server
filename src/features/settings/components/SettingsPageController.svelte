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
import * as Item from "$lib/components/ui/item/index.js";
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

  <nav aria-label={data.settingsNav.title}>
    <Item.Group class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {#each data.settingsNav.tabs as item}
        {@const Icon = tabIcon(item.icon)}
        <Item.Root
          variant={data.activeTab === item.id ? "muted" : "outline"}
          size="sm"
        >
          {#snippet child({ props })}
            <a
              {...props}
              aria-current={data.activeTab === item.id ? "page" : undefined}
              href={item.href}
            >
              <Item.Media
                variant="icon"
                class={cn(item.id === "danger" && "text-destructive")}
              >
                <Icon />
              </Item.Media>
              <Item.Content>
                <Item.Title>{item.title}</Item.Title>
                <Item.Description>{item.description}</Item.Description>
              </Item.Content>
            </a>
          {/snippet}
        </Item.Root>
      {/each}
    </Item.Group>
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
