<script lang="ts">
import { onMount } from "svelte";
import AdminOAuthClients from "@/features/admin/components/AdminOAuthClients.svelte";
import AdminOAuthDialogs from "@/features/admin/components/AdminOAuthDialogs.svelte";
import AdminOAuthHeader from "@/features/admin/components/AdminOAuthHeader.svelte";
import AdminOAuthStatusAlerts from "@/features/admin/components/AdminOAuthStatusAlerts.svelte";
import { createAdminOAuthControllerDefaultState } from "@/features/admin/lib/admin-oauth-controller-default-state";
import {
  createdOAuthCredentialsJson,
  oauthClientAuthCopy,
  oauthClientTypeLabel,
  oauthCopyValue,
  oauthRedirectCountLabel,
  oauthScopeCountLabel,
  oauthScopeLabel,
} from "@/features/admin/lib/oauth-controller";
import { createOAuthPageActions } from "@/features/admin/lib/oauth-page-actions";
import {
  availableOAuthAuthPatterns,
  buildOAuthClientTabs,
  oauthScopeOptions,
  parseOAuthRedirectUris,
  selectedOAuthAuthPattern,
} from "@/features/admin/lib/oauth-page-options";
import { createShanghaiDateTimeFormatter } from "@/lib/time/shanghai-format";
import type {
  AdminOAuthAdminCopy,
  AdminOAuthClient,
  AdminOAuthCommonCopy,
  AdminOAuthCopy,
} from "./admin-oauth-client-types";

type OAuthClient = AdminOAuthClient;

type PageData = {
  authMethods: string[];
  clients: AdminOAuthClient[];
  copy: {
    admin: AdminOAuthAdminCopy;
    common: AdminOAuthCommonCopy;
    oauth: AdminOAuthCopy;
  };
  locale: string;
};

type ActionData = {
  createdClientId?: string | null;
  createdClientRedirectUris?: string[];
  createdClientScopes?: string[];
  createdClientSecret?: string | null;
  createdClientTokenEndpointAuthMethod?: string | null;
  createdClientTrusted?: boolean | null;
} | null;

export let data: PageData;
export let form: ActionData;

let {
  activeClientTab,
  copyMessage,
  copyMessageVariant,
  deletingClientId,
  externalClientPage,
  isCreateDialogOpen,
  isCreatingClient,
  isCredentialsDialogOpen,
  isMounted: _isMounted,
  pendingDeleteClient,
  redirectDraft,
  selectedAuthMethod,
  selectedScopes,
  trustedClientPage,
} = createAdminOAuthControllerDefaultState<OAuthClient>({
  authMethods: data.authMethods,
});

$: _copy = data.copy.oauth;
$: _adminCopy = data.copy.admin;
$: _commonCopy = data.copy.common;
$: _dateTimeFormatter = createShanghaiDateTimeFormatter(data.locale, {
  dateStyle: "medium",
  timeStyle: "short",
});
$: clientTabs = buildOAuthClientTabs(_copy);
$: availableAuthPatterns = availableOAuthAuthPatterns(data.authMethods);
$: selectedAuthPattern = selectedOAuthAuthPattern(selectedAuthMethod);
$: parsedRedirectUris = parseOAuthRedirectUris(redirectDraft);

function _clientTypeLabel(method: string) {
  return oauthClientTypeLabel(method, _copy);
}

function _clientAuthCopy(method: string) {
  return oauthClientAuthCopy(method, _copy);
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

function _createdCredentialsJson() {
  return createdOAuthCredentialsJson(form ?? {});
}

const {
  closeCreateDialog: _closeCreateDialog,
  closeCredentialsDialog: _closeCredentialsDialog,
  copyText: _copyText,
  createClientAction,
  deleteClientAction,
  openCreateDialog: _openCreateDialog,
  toggleScope: _toggleScope,
} = createOAuthPageActions<OAuthClient>({
  getAuthMethods: () => data.authMethods,
  getCopy: () => _copy,
  getPendingDeleteClient: () => pendingDeleteClient,
  getSelectedAuthMethod: () => selectedAuthMethod,
  getSelectedScopes: () => selectedScopes,
  setCopyMessage: (value) => {
    copyMessage = value;
  },
  setCopyMessageVariant: (value) => {
    copyMessageVariant = value;
  },
  setDeletingClientId: (value) => {
    deletingClientId = value;
  },
  setIsCreateDialogOpen: (value) => {
    isCreateDialogOpen = value;
  },
  setIsCreatingClient: (value) => {
    isCreatingClient = value;
  },
  setIsCredentialsDialogOpen: (value) => {
    isCredentialsDialogOpen = value;
  },
  setPendingDeleteClient: (value) => {
    pendingDeleteClient = value;
  },
  setSelectedAuthMethod: (value) => {
    selectedAuthMethod = value;
  },
  setSelectedScopes: (value) => {
    selectedScopes = value;
  },
});

$: if (form?.createdClientId && _isMounted) {
  isCreateDialogOpen = false;
  isCredentialsDialogOpen = true;
}

onMount(() => {
  _isMounted = true;
});
</script>

<svelte:head><title>{_copy.adminTitle} - Life@USTC</title></svelte:head>

<section class="grid gap-5">
  <AdminOAuthHeader
    adminCopy={_adminCopy}
    commonCopy={_commonCopy}
    copy={_copy}
    disabled={!_isMounted}
    onCreate={_openCreateDialog}
  />

  <AdminOAuthStatusAlerts {copyMessage} {copyMessageVariant} {form} />

  <AdminOAuthClients
    bind:activeClientTab
    clientAuthCopy={_clientAuthCopy}
    {clientTabs}
    clientTypeLabel={_clientTypeLabel}
    clients={data.clients}
    copy={_copy}
    copyText={(value, message) => {
      void _copyText(value, message);
    }}
    bind:externalClientPage
    formatCreatedAt={_formatCreatedAt}
    onDelete={(client) => {
      pendingDeleteClient = client;
    }}
    bind:trustedClientPage
  />
</section>

<AdminOAuthDialogs
  authPatterns={availableAuthPatterns}
  closeCreateDialog={_closeCreateDialog}
  closeCredentialsDialog={_closeCredentialsDialog}
  copy={_copy}
  copyText={(value, message) => {
    void _copyText(value, message);
  }}
  {createClientAction}
  credentialsJson={_createdCredentialsJson()}
  {deleteClientAction}
  {deletingClientId}
  {form}
  {isCreatingClient}
  {isCredentialsDialogOpen}
  clientTypeLabel={_clientTypeLabel}
  oauthCopy={_oauthCopy}
  {parsedRedirectUris}
  pendingDeleteClient={pendingDeleteClient}
  redirectCountLabel={_redirectCountLabel}
  bind:redirectDraft
  scopeCountLabel={_scopeCountLabel}
  scopeLabel={_scopeLabel}
  scopeOptions={oauthScopeOptions}
  bind:selectedAuthMethod
  {selectedAuthPattern}
  bind:selectedScopes
  setPendingDeleteClient={(client) => {
    pendingDeleteClient = client;
  }}
  showCreateDialog={isCreateDialogOpen}
  toggleScope={_toggleScope}
/>
