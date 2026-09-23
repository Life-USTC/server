<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";

export let title: string;
export let description: string | undefined = undefined;
export let clearFilterLabel: string;
export let onClearFilter: (() => void) | undefined = undefined;
</script>

<Empty.Root class="min-h-24 items-start py-8 text-left">
  <Empty.Header class="items-start text-left">
    <Empty.Title>{title}</Empty.Title>
    {#if description}
      <Empty.Description>{description}</Empty.Description>
    {/if}
  </Empty.Header>
  {#if onClearFilter}
    <Empty.Content class="items-start">
      <Button variant="outline" onclick={onClearFilter}>{clearFilterLabel}</Button>
    </Empty.Content>
  {/if}
</Empty.Root>
