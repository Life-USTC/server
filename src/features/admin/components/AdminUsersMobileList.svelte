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

<Item.Group class="md:hidden" data-testid="admin-users-mobile-list">
  {#each users as user}
    <Item.Root
      class={`items-start border-l-4 text-left ${user.activeSuspension ? "border-l-warning" : user.isAdmin ? "border-l-success" : "border-l-primary"}`}
      size="sm"
      variant="outline"
    >
      {#snippet child({ props })}
        <button {...props} type="button" onclick={() => onSelect(user)}>
          <Item.Content class="min-w-0">
            <Item.Title>{displayName(user)}</Item.Title>
            <Item.Description>
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
              <div>
                <dt class="text-muted-foreground">{copy.suspension}</dt>
                <dd>{suspensionLabel(user)}</dd>
              </div>
            </dl>
          </Item.Footer>
        </button>
      {/snippet}
    </Item.Root>
  {/each}
</Item.Group>
