<script lang="ts">
import * as Empty from "$lib/components/ui/empty/index.js";
import { cn } from "$lib/utils.js";

let {
  class: className = "",
  description,
}: {
  class?: string;
  description: string;
} = $props();
</script>

<Empty.Root class={cn("min-h-20 border-0 px-2 py-6", className)}>
  <Empty.Header>
    <Empty.Description>{description}</Empty.Description>
  </Empty.Header>
</Empty.Root>
