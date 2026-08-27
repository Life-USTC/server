<script lang="ts">
import CircleUserRound from "@lucide/svelte/icons/circle-user-round";
import KeyRound from "@lucide/svelte/icons/key-round";
import Link2 from "@lucide/svelte/icons/link-2";
import ShieldAlert from "@lucide/svelte/icons/shield-alert";
import ShieldCheck from "@lucide/svelte/icons/shield-check";
import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
import { onMount } from "svelte";
import { toast } from "svelte-sonner";
import SettingsAccountsTab from "@/features/settings/components/SettingsAccountsTab.svelte";
import SettingsAuthorizationsTab from "@/features/settings/components/SettingsAuthorizationsTab.svelte";
import SettingsDangerTab from "@/features/settings/components/SettingsDangerTab.svelte";
import SettingsHeader from "@/features/settings/components/SettingsHeader.svelte";
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
import DetailSectionNav from "$lib/components/DetailSectionNav.svelte";
import PageFrame from "$lib/components/PageFrame.svelte";
import type {
  SettingsAccount,
  SettingsCopy,
  SettingsOAuthAuthorization,
  SettingsSecurityActivity,
  SettingsUser,
} from "./settings-component-types";

type PageData = {
  activeTab: SettingsTab;
  accounts: SettingsAccount[];
  authorizations: SettingsOAuthAuthorization[];
  securityActivity: SettingsSecurityActivity;
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
$: sectionNavItems = data.settingsNav.tabs.map((item) => ({
  href: item.href,
  icon: tabIcon(item.icon),
  label: item.title,
}));
$: activeNavHref =
  data.settingsNav.tabs.find((item) => item.id === data.activeTab)?.href ??
  data.settingsNav.tabs[0]?.href ??
  "";

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
  if (icon === "security") return ShieldCheck;
  if (icon === "danger") return ShieldAlert;
  return CircleUserRound;
}

onMount(() => {
  const mountTimer = setTimeout(() => {
    _isMounted = true;
  }, 0);
  return () => clearTimeout(mountTimer);
});
</script>

<svelte:head><title>{copy.settings.title} - Life@USTC</title></svelte:head>

<PageFrame width="content">
  <section class="grid gap-6">
    <SettingsHeader {copy} />

    <div class="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      <DetailSectionNav
        activeHref={activeNavHref}
        ariaLabel={data.settingsNav.title}
        items={sectionNavItems}
      />

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
    </div>
  </section>
</PageFrame>
