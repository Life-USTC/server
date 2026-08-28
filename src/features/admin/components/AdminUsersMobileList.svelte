<script lang="ts">
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import AdminListShell from "./AdminListShell.svelte";
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

<AdminListShell class="xl:hidden">
  <Item.Group class="gap-0" data-testid="admin-users-mobile-list">
    {#each users as user, index (user.id)}
      <Item.Root class="items-start px-1 py-3" size="sm">
        <Item.Content class="min-w-0">
          <Item.Title>{displayName(user)}</Item.Title>
          <Item.Description>
            @{user.username ?? copy.noUsername}
          </Item.Description>
          {@const email = user.email ?? copy.noVerifiedEmail}
          <Item.Description class="truncate" title={email}>
            {email}
          </Item.Description>
          <Item.Footer class="block pt-1">
            <dl class="grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt class="text-muted-foreground">{copy.role}</dt>
                <dd>
                  <Badge variant={user.isAdmin ? "secondary" : "ghost"}>
                    {user.isAdmin ? copy.adminRole : copy.userRole}
                  </Badge>
                </dd>
              </div>
              <div class="text-right">
                <dt class="text-muted-foreground">{copy.createdAt}</dt>
                <dd class="tabular-nums">{formatDate(user.createdAt)}</dd>
              </div>
              <div class="text-right">
                <dt class="text-muted-foreground">{copy.suspension}</dt>
                <dd>
                  {#if user.activeSuspension}
                    <Badge class="mb-1 ml-auto" variant="destructive">{copy.suspendedStatus}</Badge>
                    <span class="block truncate text-muted-foreground" title={suspensionLabel(user)}>
                      {suspensionLabel(user)}
                    </span>
                  {:else}
                    {copy.clearStatus}
                  {/if}
                </dd>
              </div>
            </dl>
          </Item.Footer>
        </Item.Content>
        <Item.Actions class="shrink-0 self-start">
          <Button
            aria-label={copy.editTitle}
            onclick={() => onSelect(user)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {copy.editTitle}
            <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
          </Button>
        </Item.Actions>
      </Item.Root>
      {#if index < users.length - 1}<Item.Separator class="my-0" />{/if}
    {/each}
  </Item.Group>
</AdminListShell>
