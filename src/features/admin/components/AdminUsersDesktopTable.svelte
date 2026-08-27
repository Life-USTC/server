<script lang="ts">
import SquarePen from "@lucide/svelte/icons/square-pen";
import DashboardTableIconButton from "@/features/dashboard/components/DashboardTableIconButton.svelte";
import DashboardTableRowActions from "@/features/dashboard/components/DashboardTableRowActions.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
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

<div class="hidden min-w-0 xl:block">
  <Table.Root class="w-full">
    <Table.Caption class="sr-only">{copy.title}</Table.Caption>
    <Table.Header>
      <Table.Row>
        <Table.Head>{copy.name}</Table.Head>
        <Table.Head>{copy.username}</Table.Head>
        <Table.Head>{copy.email}</Table.Head>
        <Table.Head class="text-center">{copy.role}</Table.Head>
        <Table.Head class="text-center">{copy.suspension}</Table.Head>
        <Table.Head class="text-right">{copy.createdAt}</Table.Head>
        <Table.Head class="w-12 text-right">
          <span class="sr-only">{copy.editTitle}</span>
        </Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each users as user}
        <Table.Row class="group">
          <Table.Cell>
            <TruncatedText class="font-medium" text={displayName(user)} />
          </Table.Cell>
          <Table.Cell>
            <span class="text-sm">
              {user.username ?? copy.noUsername}
            </span>
          </Table.Cell>
          <Table.Cell>
            <TruncatedText text={user.email ?? copy.noVerifiedEmail} />
          </Table.Cell>
          <Table.Cell class="text-center">
            <Badge variant={user.isAdmin ? "secondary" : "ghost"}>
              {user.isAdmin ? copy.adminRole : copy.userRole}
            </Badge>
          </Table.Cell>
          <Table.Cell class="text-center">
            <div class="grid min-w-0 justify-items-center gap-1">
              {#if user.activeSuspension}
                <Badge class="w-fit" variant="destructive">{copy.suspendedStatus}</Badge>
              {:else}
                <Badge class="w-fit" variant="ghost">{copy.clearStatus}</Badge>
              {/if}
              {#if user.activeSuspension}
                <TruncatedText
                  class="text-muted-foreground text-xs"
                  text={suspensionLabel(user)}
                />
              {/if}
            </div>
          </Table.Cell>
          <Table.Cell class="whitespace-nowrap text-right tabular-nums text-muted-foreground">
            {formatDate(user.createdAt)}
          </Table.Cell>
          <Table.Cell class="w-12 text-right">
            <DashboardTableRowActions class="justify-end">
              <DashboardTableIconButton
                label={copy.editTitle}
                onclick={() => onSelect(user)}
              >
                <SquarePen />
              </DashboardTableIconButton>
            </DashboardTableRowActions>
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
