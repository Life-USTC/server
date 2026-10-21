<script lang="ts">
import { onMount, untrack } from "svelte";
import { toast } from "svelte-sonner";
import CollectionPage from "#lib/components/CollectionPage.svelte";
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
import { resolveSettingsPageHeading } from "@/features/settings/lib/settings-page-heading";
import type { SettingsTab } from "@/features/settings/lib/settings-tabs";
import { goto } from "$app/navigation";
import { page as routePage } from "$app/state";
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
  user: SettingsUser & { image?: string | null; profilePictures: string[] };
};

type ActionData = {
  message?: string;
} | null;

interface Props {
  data: PageData;
  form: ActionData;
}

let { data, form }: Props = $props();

let {
  deleteConfirmValue: _deleteConfirmValue,
  isDeleteAccountOpen: _isDeleteAccountOpen,
  isDeletingAccount: _isDeletingAccount,
  isMounted: _isMounted,
  pendingAccountAction: _pendingAccountAction,
  selectedImage,
  unlinkAccountId: _unlinkAccountId,
} = $state(
  untrack(() =>
    createSettingsControllerDefaultState({
      userImage: data.user.image,
    }),
  ),
);
let consumedStatusKey = $state("");

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
let avatarOptions = $derived(
  data.user.profilePictures.length > 0 ? data.user.profilePictures : [],
);
let currentImage = $derived(data.user.image ?? "");
let previewImage = $derived(
  selectedImage || currentImage || "/images/icon.png",
);
let statusMessage = $derived(form?.message ?? data.message);
let redirectStatus = $derived(routePage.url.searchParams.get("message"));
$effect.pre(() => {
  if (!redirectStatus) {
    consumedStatusKey = "";
  }
});
let copy = $derived(data.copy);
$effect.pre(() => {
  if (
    _isMounted &&
    redirectStatus &&
    [
      "CalendarTokenRotated",
      "AuthorizationRevoked",
      "AccountDisconnected",
      "Success",
    ].includes(redirectStatus)
  ) {
    const statusKey = `${routePage.url.pathname}:${redirectStatus}`;
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
      const nextUrl = new URL(routePage.url.href);
      nextUrl.searchParams.delete("message");
      goto(nextUrl, { shallow: true, replace: true });
    }
  }
});
$effect.pre(() => {
  if (
    _unlinkAccountId &&
    !data.accounts.some(
      (account) => account.id === _unlinkAccountId && account.linked,
    )
  ) {
    _unlinkAccountId = null;
  }
});
let _unlinkAccount = $derived(
  data.accounts.find((account) => account.id === _unlinkAccountId) ?? null,
);
let _hasPendingAccountAction = $derived(Boolean(_pendingAccountAction));
let pageHeading = $derived(resolveSettingsPageHeading(copy, data.tab));
</script>

<svelte:head><title>{pageHeading.title} - Life@USTC</title></svelte:head>

<CollectionPage
  description={pageHeading.description}
  panel={false}
  title={pageHeading.title}
  width="content"
>
  <div
    class="grid min-w-0 gap-4"
    data-settings-active-panel
  >
    <SettingsStatusAlert copy={copy} statusMessage={statusMessage} />

    {#if data.tab === "profile"}
      <SettingsProfileTab
        avatarOptions={avatarOptions}
        copy={copy}
        currentImage={currentImage}
        isMounted={_isMounted}
        previewImage={previewImage}
        bind:selectedImage
        user={data.user}
      />
    {:else if data.tab === "preferences"}
      <SettingsPreferencesTab copy={copy} locale={data.locale} />
    {:else if data.tab === "accounts"}
      <SettingsAccountsTab
        accountAction={accountAction}
        accounts={data.accounts}
        copy={copy}
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
        copy={copy}
        locale={data.locale}
      />
    {:else if data.tab === "security"}
      <SettingsSecurityTab
        activity={data.securityActivity}
        copy={copy}
        locale={data.locale}
      />
    {:else}
      <SettingsDangerTab
        copy={copy}
        deleteAccountAction={deleteAccountAction}
        bind:deleteConfirmValue={_deleteConfirmValue}
        bind:isDeleteAccountOpen={_isDeleteAccountOpen}
        isDeletingAccount={_isDeletingAccount}
        isMounted={_isMounted}
      />
    {/if}
  </div>
</CollectionPage>
