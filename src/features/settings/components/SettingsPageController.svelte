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
import type {
  SettingsAccount,
  SettingsCopy,
  SettingsUser,
} from "./settings-component-types";

type PageData = {
  accounts: SettingsAccount[];
  copy: SettingsCopy;
  message?: string | null;
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

onMount(() => {
  _isMounted = true;
});
</script>

<svelte:head><title>{copy.settings.title} - Life@USTC</title></svelte:head>

<section class="grid gap-6">
  <SettingsHeader {copy} />

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
