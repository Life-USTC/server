<script lang="ts">
import AdminOAuthCreateDialog from "@/features/admin/components/AdminOAuthCreateDialog.svelte";
import AdminOAuthCredentialsDialog from "@/features/admin/components/AdminOAuthCredentialsDialog.svelte";
import AdminOAuthDeleteDialog from "@/features/admin/components/AdminOAuthDeleteDialog.svelte";
import type { SubmitFunction } from "$app/forms";
import type {
  AdminOAuthClient,
  AdminOAuthCopy,
} from "./admin-oauth-client-types";
import type {
  AuthPatternOption,
  ScopeOption,
} from "./admin-oauth-create-types";

type CreatedClientForm = {
  message?: string;
  variant?: "destructive" | "default";
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
export let copyMessage: string;
export let copyMessageVariant: "destructive" | "default";
export let copyText: (value: string, message: string) => Promise<boolean>;
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
export let clientTypeLabel: (method: string) => string;
</script>

<AdminOAuthCreateDialog
  authPatterns={authPatterns}
  close={closeCreateDialog}
  copy={copy}
  createClientAction={createClientAction}
  isCreatingClient={isCreatingClient}
  oauthCopy={oauthCopy}
  open={showCreateDialog}
  parsedRedirectUris={parsedRedirectUris}
  redirectCountLabel={redirectCountLabel}
  bind:redirectDraft
  scopeCountLabel={scopeCountLabel}
  scopeLabel={scopeLabel}
  scopeOptions={scopeOptions}
  bind:selectedAuthMethod
  selectedAuthPattern={selectedAuthPattern}
  bind:selectedScopes
/>

<AdminOAuthCredentialsDialog
  clientId={form?.createdClientId}
  clientSecret={form?.createdClientSecret}
  clientTypeLabel={clientTypeLabel}
  close={closeCredentialsDialog}
  copy={copy}
  copyMessage={copyMessage}
  copyMessageVariant={copyMessageVariant}
  copyText={copyText}
  credentialsJson={credentialsJson}
  redirectUris={form?.createdClientRedirectUris ?? []}
  scopes={form?.createdClientScopes ?? []}
  scopeLabel={scopeLabel}
  tokenEndpointAuthMethod={form?.createdClientTokenEndpointAuthMethod}
  trusted={form?.createdClientTrusted}
  open={isCredentialsDialogOpen}
/>

<AdminOAuthDeleteDialog
  client={pendingDeleteClient}
  close={() => {
    setPendingDeleteClient(null);
  }}
  copy={copy}
  deleteClientAction={deleteClientAction}
  deletingClientId={deletingClientId}
/>
