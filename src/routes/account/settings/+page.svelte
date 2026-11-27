<script lang="ts">
import { toast } from "@ui-sdk/svelte/toast";
import { onMount, untrack } from "svelte";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import SettingsAccountsTab from "@/features/settings/components/SettingsAccountsTab.svelte";
import SettingsAuthorizationsTab from "@/features/settings/components/SettingsAuthorizationsTab.svelte";
import SettingsDangerTab from "@/features/settings/components/SettingsDangerTab.svelte";
import SettingsPreferencesTab from "@/features/settings/components/SettingsPreferencesTab.svelte";
import SettingsProfileTab from "@/features/settings/components/SettingsProfileTab.svelte";
import SettingsSecurityTab from "@/features/settings/components/SettingsSecurityTab.svelte";
import type { SettingsPendingAccountAction } from "@/features/settings/components/settings-component-types";
import {
  createDeleteAccountAction,
  createSettingsAccountAction,
} from "@/features/settings/lib/settings-page-actions";
import { resolveSettingsPageHeading } from "@/features/settings/lib/settings-page-heading";
import type { SettingsTab } from "@/features/settings/lib/settings-tabs";
import { goto } from "$app/navigation";
import { page as routePage } from "$app/state";
import type { ActionData, PageData } from "./$types";

let { data, form }: { data: PageData; form: ActionData } = $props();

let deleteConfirmValue = $state("");
let isDeleteAccountOpen = $state(false);
let isDeletingAccount = $state(false);
let isMounted = $state(false);
let pendingAccountAction = $state<SettingsPendingAccountAction>(null);
let selectedImage = $state(untrack(() => data.user.image ?? undefined));
let unlinkAccountId = $state<string | null>(null);
let consumedStatusKey = $state("");
const accountAction = createSettingsAccountAction({
  setPendingAccountAction: (value) => {
    pendingAccountAction = value;
  },
});

const deleteAccountAction = createDeleteAccountAction({
  setDeletingAccount: (value) => {
    isDeletingAccount = value;
  },
});

onMount(() => {
  const mountTimer = setTimeout(() => {
    isMounted = true;
  }, 0);
  return () => clearTimeout(mountTimer);
});
let currentImage = $derived(data.user.image ?? "");
let previewImage = $derived(
  data.demo
    ? "/images/icon.png"
    : selectedImage || currentImage || "/images/icon.png",
);
let statusMessage = $derived(
  data.demo ? null : (form?.message ?? data.message),
);
let redirectStatus = $derived(
  data.demo ? null : routePage.url.searchParams.get("message"),
);
$effect.pre(() => {
  if (data.demo) selectedImage = undefined;
});
$effect.pre(() => {
  if (!redirectStatus) {
    consumedStatusKey = "";
  }
});
let copy = $derived(data.copy);
const successMessages = $derived(
  new Map([
    ["CalendarTokenRotated", copy.settings.security.calendarTokenRotated],
    ["AuthorizationRevoked", copy.settings.authorizations.revokeSuccess],
    ["AccountDisconnected", copy.profile.disconnectSuccess],
    ["Success", copy.profile.updateSuccess],
  ]),
);
$effect.pre(() => {
  const message = redirectStatus
    ? successMessages.get(redirectStatus)
    : undefined;
  if (isMounted && message !== undefined) {
    const statusKey = `${routePage.url.pathname}:${redirectStatus}`;
    if (statusKey !== consumedStatusKey) {
      consumedStatusKey = statusKey;
      toast.success(message);
      const nextUrl = new URL(routePage.url.href);
      nextUrl.searchParams.delete("message");
      goto(nextUrl, { shallow: true, replace: true });
    }
  }
});
$effect.pre(() => {
  if (
    unlinkAccountId &&
    !data.accounts.some(
      (account) => account.id === unlinkAccountId && account.linked,
    )
  ) {
    unlinkAccountId = null;
  }
});
let pageHeading = $derived(
  data.demo
    ? {
        title: copy.settings.nav.profile.title,
        description: copy.settings.nav.profile.description,
      }
    : resolveSettingsPageHeading(copy, data.tab),
);
</script>

<svelte:head><title>{pageHeading.title} - Life@USTC</title></svelte:head>

{#snippet settingsGroup(tab: SettingsTab)}
  {#if tab === "profile"}
    <SettingsProfileTab
      avatarOptions={data.user.profilePictures}
      {copy}
      {currentImage}
      {isMounted}
      {previewImage}
      bind:selectedImage
      user={data.user}
      readOnly={Boolean(data.demo)}
    />
  {:else if tab === "preferences"}
    <SettingsPreferencesTab copy={copy} locale={data.locale} />
  {:else if tab === "accounts"}
    <SettingsAccountsTab
      {accountAction}
      accounts={data.accounts}
      {copy}
      locale={data.locale}
      {isMounted}
      {pendingAccountAction}
      bind:unlinkAccountId
    />
  {:else if tab === "authorizations"}
    <SettingsAuthorizationsTab
      authorizations={data.authorizations}
      {copy}
      locale={data.locale}
    />
  {:else if tab === "security"}
    <SettingsSecurityTab
      activity={data.securityActivity}
      {copy}
      locale={data.locale}
    />
  {:else}
    <SettingsDangerTab
      {copy}
      {deleteAccountAction}
      bind:deleteConfirmValue
      bind:isDeleteAccountOpen
      {isDeletingAccount}
      {isMounted}
    />
  {/if}
{/snippet}

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
    {#if data.demo}<DemoNotice demo={data.demo} locale={data.locale} />{/if}
    {#if statusMessage && !successMessages.has(statusMessage)}
      <Alert.Root variant="destructive">
        <Alert.Title role="heading" aria-level={2}>{copy.profile.updateError}</Alert.Title>
        <Alert.Description>{statusMessage}</Alert.Description>
      </Alert.Root>
    {/if}

    <div class="grid min-w-0 gap-4" data-settings-active-group>
      {@render settingsGroup(data.tab)}
    </div>
  </div>
</CollectionPage>
