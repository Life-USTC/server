<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import AdminUsersDesktopTable from "./AdminUsersDesktopTable.svelte";
import AdminUsersMobileList from "./AdminUsersMobileList.svelte";
import type {
  AdminUserFormatter,
  AdminUserRow,
  AdminUsersCopy,
  AdminUsersPagination,
} from "./admin-user-types";

export let copy: AdminUsersCopy & {
  accountsDescription: string;
  accountsTitle: string;
  noResults: string;
  showing: string;
};
export let displayName: AdminUserFormatter;
export let formatDate: (value: Date | string | null | undefined) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let onSelect: (user: AdminUserRow) => void;
export let pagination: AdminUsersPagination;
export let suspensionLabel: AdminUserFormatter;
export let users: AdminUserRow[];
</script>

<Card.Root>
  <Card.Header>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <Card.Title>{copy.accountsTitle}</Card.Title>
        <Card.Description>
          {copy.accountsDescription}
        </Card.Description>
      </div>
      <Badge variant="ghost">
        {formatMessage(copy.showing, {
          count: String(users.length),
          total: String(pagination.total),
        })}
      </Badge>
    </div>
  </Card.Header>
  <Card.Content class="grid gap-4">
    {#if users.length === 0}
      <Alert>{copy.noResults}</Alert>
    {:else}
      <AdminUsersMobileList
        {copy}
        {displayName}
        {formatDate}
        {onSelect}
        {suspensionLabel}
        {users}
      />

      <AdminUsersDesktopTable
        {copy}
        {displayName}
        {formatDate}
        {onSelect}
        {suspensionLabel}
        {users}
      />
    {/if}
  </Card.Content>
</Card.Root>
