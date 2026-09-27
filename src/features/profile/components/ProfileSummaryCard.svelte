<script lang="ts">
import Panel from "$lib/components/Panel.svelte";
import * as Avatar from "$lib/components/ui/avatar/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type {
  ProfileSummaryCopy,
  ProfileSummaryUser,
} from "./profile-component-types";

export let copy: ProfileSummaryCopy;
export let displayName: string;
export let initials: string;
export let joinedDate: string;
export let stats: { label: string; value: number }[];
export let user: ProfileSummaryUser;
</script>

<Panel>
  {#snippet header()}
    <div class="flex min-w-0 items-center gap-4">
      <Avatar.Root class="size-20 shrink-0">
        {#if user.image}
          <Avatar.Image alt={displayName} src={user.image} />
        {/if}
        <Avatar.Fallback>{initials}</Avatar.Fallback>
      </Avatar.Root>
      <div class="min-w-0">
        <h1 class="truncate text-lg font-semibold">{displayName}</h1>
        {#if user.username}
          <p class="truncate text-muted-foreground text-sm">@{user.username}</p>
        {/if}
      </div>
    </div>
  {/snippet}

  <Item.Group>
    <Item.Root variant="muted">
      <Item.Content>
        <Item.Description>
          {copy.joinedAt.replace("{date}", joinedDate)}
        </Item.Description>
      </Item.Content>
    </Item.Root>
  </Item.Group>

  <div class="grid grid-cols-2 gap-3">
    {#each stats as stat}
      <div class="grid gap-0.5">
        <span class="text-muted-foreground text-sm">{stat.label}</span>
        <span class="text-sm leading-snug font-medium">{stat.value}</span>
      </div>
    {/each}
  </div>
</Panel>
