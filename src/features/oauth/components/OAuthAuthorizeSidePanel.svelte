<script lang="ts">
import appIconUrl from "$lib/assets/life-ustc-icon-192.png";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Item from "$lib/components/ui/item/index.js";

export let appName: string;
export let clientHost: string | undefined = undefined;
export let clientHostLabel: string | undefined = undefined;
export let redirectHost: string | undefined = undefined;
export let redirectHostLabel: string | undefined = undefined;
export let redirectIsLoopback = false;
export let loopbackRedirectWarning: string | undefined = undefined;
</script>

<Item.Root class="items-center" variant="muted">
  <Item.Media class="size-11" variant="image">
    <img class="size-full object-cover" src={appIconUrl} alt="Life@USTC" />
  </Item.Media>
  <Item.Content class="gap-1">
    <Badge class="w-fit" variant="secondary">OAuth</Badge>
    <Item.Title>{appName}</Item.Title>
    {#if clientHost && clientHostLabel}
      <Item.Description class="break-all">
        {clientHostLabel}: {clientHost}
      </Item.Description>
    {/if}
    {#if redirectHost && redirectHostLabel}
      <Item.Description class="break-all">
        {redirectHostLabel}: {redirectHost}
      </Item.Description>
    {/if}
    {#if redirectIsLoopback && loopbackRedirectWarning}
      <p class="text-destructive text-xs">{loopbackRedirectWarning}</p>
    {/if}
  </Item.Content>
</Item.Root>
