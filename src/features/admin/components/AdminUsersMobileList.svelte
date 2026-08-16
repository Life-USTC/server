<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Item from "$lib/components/ui/item/index.js";
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

<Item.Group class="xl:hidden" data-testid="admin-users-mobile-list">
  {#each users as user}
    <Item.Root class="items-start text-left" size="sm" variant="outline">
      {#snippet child({ props })}
        <button {...props} type="button" onclick={() => onSelect(user)}>
          <Item.Content class="min-w-0">
            <Item.Title>{displayName(user)}</Item.Title>
            <Item.Description class="font-mono">
              @{user.username ?? copy.noUsername}
            </Item.Description>
            <Item.Description class="line-clamp-none break-words">
              {user.email ?? copy.noVerifiedEmail}
            </Item.Description>
          </Item.Content>
          <Item.Actions>
            <Badge variant={user.isAdmin ? "secondary" : "ghost"}>
              {user.isAdmin ? copy.adminRole : copy.userRole}
            </Badge>
          </Item.Actions>
          <Item.Footer class="block">
            <dl class="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt class="text-muted-foreground">{copy.createdAt}</dt>
                <dd class="tabular-nums">{formatDate(user.createdAt)}</dd>
              </div>
              <div class="text-right">
                <dt class="text-muted-foreground">{copy.suspension}</dt>
                <dd>
                  {#if user.activeSuspension}
                    <Badge class="mb-1 ml-auto" variant="destructive">{copy.suspendedStatus}</Badge>
                    <span class="block text-muted-foreground">
                      {suspensionLabel(user)}
                    </span>
                  {:else}
                    {copy.clearStatus}
                  {/if}
                </dd>
              </div>
            </dl>
          </Item.Footer>
        </button>
      {/snippet}
    </Item.Root>
  {/each}
</Item.Group>
