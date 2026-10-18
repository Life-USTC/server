<script lang="ts">
import * as Empty from "#lib/components/ui/empty/index.js";
import { cn } from "#lib/utils.js";

let {
  class: className = "",
  description,
  title,
}: {
  class?: string;
  description: string;
  title?: string;
} = $props();
</script>

<Empty.Root
  class={cn("min-h-20 items-start border-0 px-2 py-6 text-left", className)}
  data-testid="compact-empty"
>
  <Empty.Header class="items-start text-left">
    {#if title}
      <Empty.Title>{title}</Empty.Title>
    {/if}
    <Empty.Description>{description}</Empty.Description>
  </Empty.Header>
</Empty.Root>
