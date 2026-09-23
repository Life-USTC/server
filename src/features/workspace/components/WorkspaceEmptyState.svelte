<script lang="ts">
import * as Empty from "$lib/components/ui/empty/index.js";

export let title: string;
export let description: string | undefined = undefined;
export let className = "";
export let headerClassName = "";
</script>

<Empty.Root class={className}>
  <Empty.Header class={headerClassName}>
    <Empty.Title>{title}</Empty.Title>
    {#if description}
      <Empty.Description>{description}</Empty.Description>
    {/if}
  </Empty.Header>
</Empty.Root>
