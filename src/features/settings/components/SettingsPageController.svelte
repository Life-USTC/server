<script lang="ts">
import { onMount } from "svelte";
import { toast } from "svelte-sonner";
import SettingsAccountsTab from "@/features/settings/components/SettingsAccountsTab.svelte";
import SettingsAuthorizationsTab from "@/features/settings/components/SettingsAuthorizationsTab.svelte";
import SettingsDangerTab from "@/features/settings/components/SettingsDangerTab.svelte";
import SettingsPreferencesTab from "@/features/settings/components/SettingsPreferencesTab.svelte";
import SettingsProfileTab from "@/features/settings/components/SettingsProfileTab.svelte";
import SettingsSecurityTab from "@/features/settings/components/SettingsSecurityTab.svelte";
import SettingsStatusAlert from "@/features/settings/components/SettingsStatusAlert.svelte";
import { createSettingsControllerDefaultState } from "@/features/settings/lib/settings-controller-default-state";
import {
  createDeleteAccountAction,
  createSettingsAccountAction,
} from "@/features/settings/lib/settings-page-actions";
import type { SettingsTab } from "@/features/settings/lib/settings-tabs";
import { replaceState } from "$app/navigation";
import { page } from "$app/stores";
import CollectionPage from "$lib/components/CollectionPage.svelte";
import type {
  SettingsAccount,
  SettingsCopy,
  SettingsOAuthAuthorization,
  SettingsSecurityActivity,
  SettingsUser,
} from "./settings-component-types";

type PageData = {
  accounts: SettingsAccount[];
  authorizations: SettingsOAuthAuthorization[];
  securityActivity: SettingsSecurityActivity;
  copy: SettingsCopy;
  locale: "en-us" | "zh-cn";
  message?: string | null;
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
let consumedStatusKey = "";
$: avatarOptions =
  data.user.profilePictures.length > 0 ? data.user.profilePictures : [];
$: currentImage = data.user.image ?? "";
$: previewImage = selectedImage || currentImage || "/images/icon.png";
$: statusMessage = form?.message ?? data.message;
$: redirectStatus = $page.url.searchParams.get("message");
$: if (!redirectStatus) {
  consumedStatusKey = "";
}
$: if (
  _isMounted &&
  redirectStatus &&
  [
    "CalendarTokenRotated",
    "AuthorizationRevoked",
    "AccountDisconnected",
    "Success",
  ].includes(redirectStatus)
) {
  const statusKey = `${$page.url.pathname}:${redirectStatus}`;
  if (statusKey !== consumedStatusKey) {
    consumedStatusKey = statusKey;
    const message =
      redirectStatus === "CalendarTokenRotated"
        ? copy.settings.security.calendarTokenRotated
        : redirectStatus === "AuthorizationRevoked"
          ? copy.settings.authorizations.revokeSuccess
          : redirectStatus === "AccountDisconnected"
            ? copy.profile.disconnectSuccess
            : copy.profile.updateSuccess;
    toast.success(message);
    const nextUrl = new URL($page.url);
    nextUrl.searchParams.delete("message");
    replaceState(nextUrl, {});
  }
}
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
  const mountTimer = setTimeout(() => {
    _isMounted = true;
  }, 0);
  return () => clearTimeout(mountTimer);
});
</script>

<svelte:head><title>{copy.settings.title} - Life@USTC</title></svelte:head>

<CollectionPage description={copy.settings.description} panel={false} title={copy.settings.title} width="content">
  <div class="grid min-w-0 gap-4" data-settings-active-panel>
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
          locale={data.locale}
          hasPendingAccountAction={_hasPendingAccountAction}
          isMounted={_isMounted}
          pendingAccountAction={_pendingAccountAction}
          unlinkAccount={_unlinkAccount}
          bind:unlinkAccountId={_unlinkAccountId}
        />
      {:else if data.tab === "authorizations"}
        <SettingsAuthorizationsTab
          authorizations={data.authorizations}
          {copy}
          locale={data.locale}
        />
      {:else if data.tab === "security"}
        <SettingsSecurityTab
          activity={data.securityActivity}
          {copy}
          locale={data.locale}
        />
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
</CollectionPage>
