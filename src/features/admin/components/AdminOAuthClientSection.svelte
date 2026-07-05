<script lang="ts">
import AdminOAuthClientCard from "@/features/admin/components/AdminOAuthClientCard.svelte";
import {
  oauthClientSectionItems,
  oauthClientSectionPageCount,
  oauthClientSectionStatus,
} from "@/features/admin/lib/admin-oauth-client-section-pagination";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import AdminOAuthClientSectionPagination from "./AdminOAuthClientSectionPagination.svelte";
import type {
  AdminOAuthClient,
  AdminOAuthCopy,
} from "./admin-oauth-client-types";

type Copy = AdminOAuthCopy & {
  clientPageStatus: string;
};

export let clientAuthCopy: (method: string) => string;
export let clientTypeLabel: (method: string) => string;
export let clients: AdminOAuthClient[];
export let copy: Copy;
export let copyText: (value: string, message: string) => void;
export let description: string;
export let emptyMessage: string;
export let formatCreatedAt: (value: string | Date) => string;
export let onDelete: (client: AdminOAuthClient) => void;
export let page: number;
export let title: string;

$: page = Math.min(page, pageCount);
$: pageCount = oauthClientSectionPageCount(clients);
$: pageClients = oauthClientSectionItems(clients, page);
$: pageStatus = oauthClientSectionStatus({
  currentPage: page,
  sectionClients: clients,
  template: copy.clientPageStatus,
});
</script>

<section class="grid min-w-0 gap-3">
  <div class="flex min-w-0 items-start justify-between gap-3">
    <div class="min-w-0">
      <h3 class="font-medium text-base">{title}</h3>
      <p class="text-muted-foreground text-sm">{description}</p>
    </div>
    <Badge variant="outline">{clients.length}</Badge>
  </div>

  <div class="grid gap-3">
    {#each pageClients as client}
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
      <Empty.Root class="min-h-24">
        <Empty.Header>
          <Empty.Description>{emptyMessage}</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {/each}
  </div>

  {#if pageCount > 1}
    <AdminOAuthClientSectionPagination
      {copy}
      bind:page
      {pageCount}
      status={pageStatus}
    />
  {/if}
</section>
