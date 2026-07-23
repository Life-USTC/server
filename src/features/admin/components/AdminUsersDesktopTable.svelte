<script lang="ts">
import TruncatedText from "$lib/components/TruncatedText.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import type {
  AdminUserFormatter,
  AdminUserRow,
  AdminUsersCopy,
} from "./admin-user-types";

export let copy: AdminUsersCopy;
export let displayName: AdminUserFormatter;
export let formatDate: (value: Date | string | null | undefined) => string;
export let onSelect: (user: AdminUserRow) => void;
export let suspensionLabel: AdminUserFormatter;
export let users: AdminUserRow[];
</script>

<div class="hidden md:block">
  <Table.Root>
    <Table.Header>
      <Table.Row>
        <Table.Head>{copy.name}</Table.Head>
        <Table.Head>{copy.username}</Table.Head>
        <Table.Head>{copy.email}</Table.Head>
        <Table.Head>{copy.role}</Table.Head>
        <Table.Head>{copy.suspension}</Table.Head>
        <Table.Head>{copy.createdAt}</Table.Head>
        <Table.Head class="w-24 text-right">{copy.editTitle}</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each users as user}
        <Table.Row>
          <Table.Cell class="max-w-56">
            <TruncatedText class="font-medium" text={displayName(user)} />
            <TruncatedText
              class="font-mono text-muted-foreground text-xs"
              text={user.id}
            />
          </Table.Cell>
          <Table.Cell class="max-w-48">
            <TruncatedText text={user.username ?? copy.noUsername} />
          </Table.Cell>
          <Table.Cell class="max-w-64">
            <TruncatedText text={user.email ?? copy.noVerifiedEmail} />
          </Table.Cell>
          <Table.Cell>
            <Badge variant={user.isAdmin ? "secondary" : "ghost"}>
              {user.isAdmin ? copy.adminRole : copy.userRole}
            </Badge>
          </Table.Cell>
          <Table.Cell>
            <div class="grid gap-1">
              {#if user.activeSuspension}
                <Badge class="w-fit" variant="destructive">{copy.suspendedStatus}</Badge>
              {:else}
                <Badge class="w-fit" variant="ghost">{copy.clearStatus}</Badge>
              {/if}
              <TruncatedText
                class="text-muted-foreground text-xs"
                text={user.activeSuspension ? suspensionLabel(user) : null}
              />
            </div>
          </Table.Cell>
          <Table.Cell>{formatDate(user.createdAt)}</Table.Cell>
          <Table.Cell class="text-right">
            <Button
              size="sm"
              type="button"
              variant="outline"
              onclick={() => onSelect(user)}
            >
              {copy.editTitle}
            </Button>
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
