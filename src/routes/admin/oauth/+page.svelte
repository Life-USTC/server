<script lang="ts">
import { toast } from "@ui-sdk/svelte/toast";
import { onMount } from "svelte";
import PageHeader from "#lib/components/PageHeader.svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import AdminDeleteDialog from "@/features/admin/components/AdminDeleteDialog.svelte";
import AdminOAuthClients from "@/features/admin/components/AdminOAuthClients.svelte";
import AdminOAuthCreateDialog from "@/features/admin/components/AdminOAuthCreateDialog.svelte";
import AdminOAuthCredentialsDialog from "@/features/admin/components/AdminOAuthCredentialsDialog.svelte";
import AdminWorkspace from "@/features/admin/components/AdminWorkspace.svelte";
import type { AdminOAuthClient as OAuthClient } from "@/features/admin/components/admin-oauth-client-types";
import { createAdminOAuthControllerDefaultState } from "@/features/admin/lib/admin-oauth-controller-default-state";
import {
  createdOAuthCredentialsJson,
  oauthClientTypeLabel,
  oauthCopyValue,
  oauthRedirectCountLabel,
  oauthScopeCountLabel,
  oauthScopeLabel,
} from "@/features/admin/lib/oauth-controller";
import { createOAuthPageActions } from "@/features/admin/lib/oauth-page-actions";
import {
  availableOAuthAuthPatterns,
  oauthScopeOptions,
  parseOAuthRedirectUris,
  selectedOAuthAuthPattern,
} from "@/features/admin/lib/oauth-page-options";
import { campusTimestampFormatter } from "@/lib/time/shanghai-format";
import type { ActionData, PageData } from "./$types";

export let data: PageData;
export let form: ActionData;

let state = createAdminOAuthControllerDefaultState<OAuthClient>(data);

function set<K extends keyof typeof state>(key: K) {
  return (value: (typeof state)[K]) => {
    state[key] = value;
  };
}
let openedCredentialsClientId: string | null = null;

$: _copy = data.copy.oauth;
$: _dateTimeFormatter = campusTimestampFormatter(data.locale);
$: availableAuthPatterns = availableOAuthAuthPatterns(data.authMethods);
$: selectedAuthPattern = selectedOAuthAuthPattern(state.selectedAuthMethod);
$: parsedRedirectUris = parseOAuthRedirectUris(state.redirectDraft);

function _clientTypeLabel(method: string) {
  return oauthClientTypeLabel(method, _copy);
}

function _scopeLabel(scope: string) {
  return oauthScopeLabel(scope, _copy);
}

function _oauthCopy(key: string) {
  return oauthCopyValue(key, _copy);
}

function _redirectCountLabel(count: number) {
  return oauthRedirectCountLabel(count, data.locale);
}

function _scopeCountLabel(count: number) {
  return oauthScopeCountLabel(count, data.locale);
}

function _formatCreatedAt(value: string | Date) {
  return _dateTimeFormatter.format(new Date(value));
}

const {
  closeCreateDialog: _closeCreateDialog,
  closeCredentialsDialog: _closeCredentialsDialog,
  copyText: _copyText,
  createClientAction,
  deleteClientAction,
  openCreateDialog: _openCreateDialog,
} = createOAuthPageActions<OAuthClient>({
  getAuthMethods: () => data.authMethods,
  getCopy: () => _copy,
  getPendingDeleteClient: () => state.pendingDeleteClient,
  getSelectedAuthMethod: () => state.selectedAuthMethod,
  getSelectedScopes: () => state.selectedScopes,
  onCopySuccess: (message) => {
    toast.success(message);
  },
  onSuccess: (action) => {
    toast.success(
      action === "create" ? _copy.createSuccess : _copy.deleteSuccess,
    );
  },
  setCopyMessage: set("copyMessage"),
  setCopyMessageVariant: set("copyMessageVariant"),
  setDeletingClientId: set("deletingClientId"),
  setIsCreateDialogOpen: set("isCreateDialogOpen"),
  setIsCreatingClient: set("isCreatingClient"),
  setIsCredentialsDialogOpen: set("isCredentialsDialogOpen"),
  setPendingDeleteClient: set("pendingDeleteClient"),
  setSelectedAuthMethod: set("selectedAuthMethod"),
  setSelectedScopes: set("selectedScopes"),
});

$: if (
  form?.createdClientId &&
  form.createdClientId !== openedCredentialsClientId &&
  state.isMounted
) {
  openedCredentialsClientId = form.createdClientId;
  state.copyMessage = "";
  state.isCreateDialogOpen = false;
  state.isCredentialsDialogOpen = true;
}

onMount(() => {
  state.isMounted = true;
});
</script>

<svelte:head><title>{_copy.adminTitle} - Life@USTC</title></svelte:head>

<AdminWorkspace>
  {#snippet header()}
    <PageHeader title={_copy.adminTitle} description={_copy.adminSubtitle} eyebrow={data.copy.admin.title}>
      {#snippet after()}
        <p class="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {_copy.publicationIngestionServiceNotice}
        </p>
      {/snippet}
      {#snippet actions()}
        <Button class="w-full sm:w-auto" disabled={!state.isMounted} onclick={_openCreateDialog}>
          {_copy.createClient}
        </Button>
      {/snippet}
    </PageHeader>
  {/snippet}
  {#snippet feedback()}
    {#if state.copyMessage && !state.isCredentialsDialogOpen}
      <Alert.Root variant="destructive">
        <Alert.Description>{state.copyMessage}</Alert.Description>
      </Alert.Root>
    {/if}

    {#if form?.message && !form?.createdClientId && form.variant === "destructive"}
      <Alert.Root variant={form.variant ?? "default"}>
        <Alert.Description>{form.message}</Alert.Description>
      </Alert.Root>
    {/if}
  {/snippet}
  <AdminOAuthClients
    clientTypeLabel={_clientTypeLabel}
    clients={data.clients}
    copy={_copy}
    formatCreatedAt={_formatCreatedAt}
    onDelete={(client) => {
      state.pendingDeleteClient = client;
    }}
    scopeLabel={_scopeLabel}
  />
</AdminWorkspace>

<AdminOAuthCreateDialog
  authPatterns={availableAuthPatterns}
  close={_closeCreateDialog}
  copy={_copy}
  {createClientAction}
  isCreatingClient={state.isCreatingClient}
  oauthCopy={_oauthCopy}
  open={state.isCreateDialogOpen}
  {parsedRedirectUris}
  redirectCountLabel={_redirectCountLabel}
  bind:redirectDraft={state.redirectDraft}
  scopeCountLabel={_scopeCountLabel}
  scopeLabel={_scopeLabel}
  scopeOptions={oauthScopeOptions}
  bind:selectedAuthMethod={state.selectedAuthMethod}
  {selectedAuthPattern}
  bind:selectedScopes={state.selectedScopes}
/>

<AdminOAuthCredentialsDialog
  clientId={form?.createdClientId}
  clientSecret={form?.createdClientSecret}
  clientTypeLabel={_clientTypeLabel}
  close={_closeCredentialsDialog}
  copy={_copy}
  copyMessage={state.copyMessage}
  copyMessageVariant={state.copyMessageVariant}
  copyText={_copyText}
  credentialsJson={createdOAuthCredentialsJson(form ?? {})}
  redirectUris={form?.createdClientRedirectUris ?? []}
  scopes={form?.createdClientScopes ?? []}
  scopeLabel={_scopeLabel}
  tokenEndpointAuthMethod={form?.createdClientTokenEndpointAuthMethod}
  trusted={form?.createdClientTrusted}
  open={state.isCredentialsDialogOpen}
/>

{#if state.pendingDeleteClient}
  {@const client = state.pendingDeleteClient}
  <AdminDeleteDialog
    titleId="oauth-delete-title"
    title={_copy.deleteClient}
    description={_copy.deleteClientDescription.replace("{name}", client.name ?? _copy.unnamedClient)}
    cancelLabel={_copy.cancel}
    confirmLabel={_copy.deleteClient}
    close={() => { state.pendingDeleteClient = null; }}
    action="?/deleteClient"
    submit={deleteClientAction}
    busy={Boolean(state.deletingClientId)}
  >
    <input type="hidden" name="clientId" value={client.clientId} />
    <p class="break-all font-mono text-muted-foreground text-xs">{client.clientId}</p>
  </AdminDeleteDialog>
{/if}
