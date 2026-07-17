<script lang="ts">
import AdminOAuthClientSection from "@/features/admin/components/AdminOAuthClientSection.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import type {
  AdminOAuthClient,
  AdminOAuthCopy,
} from "./admin-oauth-client-types";

export let clientAuthCopy: (method: string) => string;
export let clientTypeLabel: (method: string) => string;
export let clients: AdminOAuthClient[];
export let copy: AdminOAuthCopy;
export let copyText: (value: string, message: string) => void;
export let createDisabled: boolean;
export let externalClientPage: number;
export let externalClients: AdminOAuthClient[];
export let formatCreatedAt: (value: string | Date) => string;
export let onDelete: (client: AdminOAuthClient) => void;
export let onCreate: () => void;
export let trustedClientPage: number;
export let trustedClients: AdminOAuthClient[];
</script>

{#if clients.length === 0}
  <Empty.Root class="items-start text-left" data-oauth-empty-state>
    <Empty.Header class="items-start text-left">
      <Empty.Title>{copy.noClients}</Empty.Title>
      <Empty.Description>{copy.noClientsDescription}</Empty.Description>
    </Empty.Header>
    <Empty.Content class="items-start">
      <Button disabled={createDisabled} onclick={onCreate}>
        {copy.createClient}
      </Button>
    </Empty.Content>
  </Empty.Root>
{:else}
  <div class="grid min-w-0 items-start gap-4 2xl:grid-cols-2">
    <AdminOAuthClientSection
      {clientAuthCopy}
      {clientTypeLabel}
      clients={trustedClients}
      {copy}
      {copyText}
      description={copy.sectionTrustedDescription}
      emptyMessage={copy.noTrustedClients}
      {formatCreatedAt}
      {onDelete}
      bind:page={trustedClientPage}
      title={copy.sectionTrustedTitle}
    />
    <AdminOAuthClientSection
      {clientAuthCopy}
      {clientTypeLabel}
      clients={externalClients}
      {copy}
      {copyText}
      description={copy.sectionExternalDescription}
      emptyMessage={copy.noExternalClients}
      {formatCreatedAt}
      {onDelete}
      bind:page={externalClientPage}
      title={copy.sectionExternalTitle}
    />
  </div>
{/if}
