<script lang="ts">
import * as Avatar from "$lib/components/ui/avatar/index.js";
import * as Card from "$lib/components/ui/card/index.js";
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

<Card.Root class="border-base-300 bg-base-100">
  <Card.Content class="grid gap-5 pt-5">
    <div class="flex items-start gap-4">
      <Avatar.Root class="h-20 w-20 shrink-0">
        {#if user.image}
          <Avatar.Image alt={displayName} src={user.image} />
        {:else}
          <Avatar.Fallback class="text-3xl">{initials}</Avatar.Fallback>
        {/if}
      </Avatar.Root>
      <div class="min-w-0">
        <h1 class="truncate font-semibold text-2xl">{displayName}</h1>
        {#if user.username}
          <p class="truncate text-base-content/60">@{user.username}</p>
        {/if}
        {#if showUserId}
          <p class="mt-2 break-all rounded-md border border-base-300 bg-base-200/60 px-2 py-1 font-mono text-base-content/70 text-xs">
            {user.id}
          </p>
        {/if}
      </div>
    </div>

    <div class="rounded-md border border-base-300 bg-base-200/50 px-3 py-2 text-base-content/70 text-sm">
      <p>{copy.joinedAt.replace("{date}", joinedDate)}</p>
    </div>

    <div class="grid grid-cols-2 gap-3">
      {#each stats as stat}
        <div class="rounded-md border border-base-300 bg-base-100 p-3">
          <p class="text-base-content/60 text-xs">{stat.label}</p>
          <p class="font-semibold text-2xl">{stat.value}</p>
        </div>
      {/each}
    </div>
  </Card.Content>
</Card.Root>
