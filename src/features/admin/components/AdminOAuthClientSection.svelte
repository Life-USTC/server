<script lang="ts">
import AdminOAuthClientCard from "@/features/admin/components/AdminOAuthClientCard.svelte";
import {
  oauthClientSectionItems,
  oauthClientSectionPageCount,
  oauthClientSectionStatus,
} from "@/features/admin/lib/admin-oauth-client-section-pagination";
import { Alert } from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
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

<section class="min-w-0 rounded-md border border-base-300 bg-base-100">
  <header class="border-base-300 border-b p-4">
    <div class="flex flex-wrap items-center gap-2">
      <h2 class="font-semibold text-base">{title}</h2>
      <Badge variant="outline">{clients.length}</Badge>
    </div>
    <p class="mt-1 text-base-content/60 text-sm">{description}</p>
  </header>
  <div class="grid gap-3 p-4">
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
      <Alert>{emptyMessage}</Alert>
    {/each}
    <AdminOAuthClientSectionPagination
      {copy}
      bind:page
      {pageCount}
      status={pageStatus}
    />
  </div>
</section>
