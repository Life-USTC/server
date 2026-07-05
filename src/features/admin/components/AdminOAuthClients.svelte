<script lang="ts">
import AdminOAuthAllClients from "@/features/admin/components/AdminOAuthAllClients.svelte";
import AdminOAuthClientCard from "@/features/admin/components/AdminOAuthClientCard.svelte";
import AdminOAuthClientTabs from "@/features/admin/components/AdminOAuthClientTabs.svelte";
import {
  oauthClientGroups,
  visibleOAuthClientsForTab,
} from "@/features/admin/lib/admin-oauth-client-groups";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import type {
  AdminOAuthClient,
  AdminOAuthClientCopy,
} from "./admin-oauth-client-types";

type ClientTab = "trusted" | "public" | "disabled" | "all";

export let activeClientTab: ClientTab;
export let clientAuthCopy: (method: string) => string;
export let clientTabs: readonly (readonly [ClientTab, string])[];
export let clientTypeLabel: (method: string) => string;
export let clients: AdminOAuthClient[];
export let copy: AdminOAuthClientCopy;
export let copyText: (value: string, message: string) => void;
export let externalClientPage: number;
export let formatCreatedAt: (value: string | Date) => string;
export let onDelete: (client: AdminOAuthClient) => void;
export let trustedClientPage: number;

$: ({ trustedClients, externalClients } = oauthClientGroups(clients));
$: visibleClients = visibleOAuthClientsForTab(clients, activeClientTab);
</script>

<section class="grid gap-3">
  <div class="flex min-w-0 items-start justify-between gap-3">
    <div class="min-w-0">
      <h2 class="font-semibold text-lg">{copy.existingClients}</h2>
      <p class="text-muted-foreground text-sm">
        {copy.existingClientsDescription}
      </p>
    </div>
    <Badge variant="secondary">
      {copy.clientCount.replace("{count}", String(clients.length))}
    </Badge>
  </div>

  <AdminOAuthClientTabs
    bind:activeClientTab
    {clientTabs}
    {copy}
  />
  {#if activeClientTab === "all"}
    <AdminOAuthAllClients
      {clientAuthCopy}
      {clientTypeLabel}
      {clients}
      {copy}
      {copyText}
      bind:externalClientPage
      {externalClients}
      {formatCreatedAt}
      {onDelete}
      bind:trustedClientPage
      {trustedClients}
    />
  {:else}
    <div class="grid gap-3">
      {#each visibleClients as client}
        <AdminOAuthClientCard
          {client}
          {clientAuthCopy}
          {clientTypeLabel}
          {copy}
          {copyText}
          {formatCreatedAt}
          {onDelete}
        />
      {:else}
        <Empty.Root>
          <Empty.Header>
            <Empty.Description>{copy.noClientsInGroup}</Empty.Description>
          </Empty.Header>
        </Empty.Root>
      {/each}
    </div>
  {/if}
</section>
