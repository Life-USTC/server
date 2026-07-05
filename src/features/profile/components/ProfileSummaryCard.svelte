<script lang="ts">
import * as Avatar from "$lib/components/ui/avatar/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type {
  ProfileSummaryCopy,
  ProfileSummaryUser,
} from "./profile-component-types";

export let copy: ProfileSummaryCopy;
export let displayName: string;
export let initials: string;
export let joinedDate: string;
export let showUserId = false;
export let stats: { label: string; value: number }[];
export let user: ProfileSummaryUser;
</script>

<Card.Root>
  <Card.Header class="gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
    <Avatar.Root class="size-20 shrink-0">
      {#if user.image}
        <Avatar.Image alt={displayName} src={user.image} />
      {/if}
      <Avatar.Fallback class="text-3xl">{initials}</Avatar.Fallback>
    </Avatar.Root>
    <div class="min-w-0">
      <Card.Title class="truncate text-2xl" role="heading" aria-level={1}>
        {displayName}
      </Card.Title>
      {#if user.username}
        <Card.Description class="truncate">@{user.username}</Card.Description>
      {/if}
      {#if showUserId}
        <Badge class="mt-2 h-auto max-w-full shrink justify-start whitespace-normal break-all font-mono" variant="outline">
          {user.id}
        </Badge>
      {/if}
    </div>
  </Card.Header>

  <Card.Content class="grid gap-3">
    <Item.Group>
      <Item.Root variant="muted">
        <Item.Content>
          <Item.Description>
            {copy.joinedAt.replace("{date}", joinedDate)}
          </Item.Description>
        </Item.Content>
      </Item.Root>
    </Item.Group>

    <Item.Group class="grid grid-cols-2 gap-3">
      {#each stats as stat}
        <Item.Root class="items-start" variant="outline">
          <Item.Content>
            <Item.Description>{stat.label}</Item.Description>
            <Item.Title class="text-2xl">{stat.value}</Item.Title>
          </Item.Content>
        </Item.Root>
      {/each}
    </Item.Group>
  </Card.Content>
</Card.Root>
