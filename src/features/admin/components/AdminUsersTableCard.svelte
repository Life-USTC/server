<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
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
    <Card.Title>{copy.accountsTitle}</Card.Title>
    <Card.Description>
      {copy.accountsDescription}
    </Card.Description>
    <Card.Action>
      <Badge variant="ghost">
        {formatMessage(copy.showing, {
          count: String(users.length),
          total: String(pagination.total),
        })}
      </Badge>
    </Card.Action>
  </Card.Header>
  <Card.Content class="grid gap-4">
    {#if users.length === 0}
      <Empty.Root class="min-h-24">
        <Empty.Header>
          <Empty.Description>{copy.noResults}</Empty.Description>
        </Empty.Header>
      </Empty.Root>
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
