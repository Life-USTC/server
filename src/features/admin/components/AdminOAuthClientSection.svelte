<script lang="ts">
import AdminOAuthClientCard from "@/features/admin/components/AdminOAuthClientCard.svelte";
import {
  oauthClientSectionItems,
  oauthClientSectionPageCount,
  oauthClientSectionStatus,
} from "@/features/admin/lib/admin-oauth-client-section-pagination";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
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

<section class="min-w-0">
  <Card.Root>
    <Card.Header class="border-b">
      <Card.Title>{title}</Card.Title>
      <Card.Description>{description}</Card.Description>
      <Card.Action>
        <Badge variant="outline">{clients.length}</Badge>
      </Card.Action>
    </Card.Header>
    <Card.Content class="grid gap-3">
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
        <Alert.Root>
          <Alert.Description>{emptyMessage}</Alert.Description>
        </Alert.Root>
      {/each}
    </Card.Content>
    {#if pageCount > 1}
      <Card.Footer>
        <AdminOAuthClientSectionPagination
          {copy}
          bind:page
          {pageCount}
          status={pageStatus}
        />
      </Card.Footer>
    {/if}
  </Card.Root>
</section>
