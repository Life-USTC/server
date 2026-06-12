<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import AdminOAuthCreateDialog from "@/features/admin/components/AdminOAuthCreateDialog.svelte";
import AdminOAuthCredentialsDialog from "@/features/admin/components/AdminOAuthCredentialsDialog.svelte";
import AdminOAuthDeleteDialog from "@/features/admin/components/AdminOAuthDeleteDialog.svelte";
import type {
  AdminOAuthClient,
  AdminOAuthCopy,
} from "./admin-oauth-client-types";
import type {
  AuthPatternOption,
  ScopeOption,
} from "./admin-oauth-create-types";

type CreatedClientForm = {
  createdClientId?: string | null;
  createdClientRedirectUris?: string[];
  createdClientScopes?: string[];
  createdClientSecret?: string | null;
  createdClientTokenEndpointAuthMethod?: string | null;
  createdClientTrusted?: boolean | null;
};

export let authPatterns: AuthPatternOption[];
export let closeCreateDialog: () => void;
export let closeCredentialsDialog: () => void;
export let copy: AdminOAuthCopy;
export let copyText: (value: string, message: string) => void;
export let createClientAction: SubmitFunction;
export let credentialsJson: string;
export let deleteClientAction: SubmitFunction;
export let deletingClientId: string | null;
export let form: CreatedClientForm | null | undefined;
export let isCreatingClient: boolean;
export let isCredentialsDialogOpen: boolean;
export let oauthCopy: (key: string) => string;
export let parsedRedirectUris: string[];
export let pendingDeleteClient: AdminOAuthClient | null;
export let redirectCountLabel: (count: number) => string;
export let redirectDraft: string;
export let scopeCountLabel: (count: number) => string;
export let scopeLabel: (scope: string) => string;
export let scopeOptions: ScopeOption[];
export let selectedAuthMethod: string;
export let selectedAuthPattern: AuthPatternOption;
export let selectedScopes: string[];
export let setPendingDeleteClient: (client: AdminOAuthClient | null) => void;
export let showCreateDialog: boolean;
export let toggleScope: (scope: string, checked: boolean) => void;
export let clientTypeLabel: (method: string) => string;
</script>

<AdminOAuthCreateDialog
  {authPatterns}
  close={closeCreateDialog}
  {copy}
  {createClientAction}
  {isCreatingClient}
  {oauthCopy}
  open={showCreateDialog}
  {parsedRedirectUris}
  {redirectCountLabel}
  bind:redirectDraft
  {scopeCountLabel}
  {scopeLabel}
  {scopeOptions}
  bind:selectedAuthMethod
  {selectedAuthPattern}
  bind:selectedScopes
  {toggleScope}
/>

<AdminOAuthCredentialsDialog
  clientId={form?.createdClientId}
  clientSecret={form?.createdClientSecret}
  {clientTypeLabel}
  close={closeCredentialsDialog}
  {copy}
  {copyText}
  {credentialsJson}
  redirectUris={form?.createdClientRedirectUris ?? []}
  scopes={form?.createdClientScopes ?? []}
  {scopeLabel}
  tokenEndpointAuthMethod={form?.createdClientTokenEndpointAuthMethod}
  trusted={form?.createdClientTrusted}
  open={isCredentialsDialogOpen}
/>

<AdminOAuthDeleteDialog
  client={pendingDeleteClient}
  close={() => {
    setPendingDeleteClient(null);
  }}
  {copy}
  {deleteClientAction}
  {deletingClientId}
/>
