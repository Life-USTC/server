<script lang="ts">
import type { Snippet } from "svelte";
import * as Empty from "$lib/components/ui/empty";

let {
  title,
  description,
  children,
}: { title: string; description: string; children?: Snippet } = $props();
</script>
<Empty.Root class="items-start text-left">
  <Empty.Header class="items-start text-left"><Empty.Title>{title}</Empty.Title><Empty.Description>{description}</Empty.Description></Empty.Header>
  {#if children}<Empty.Content class="items-start">{@render children()}</Empty.Content>{/if}
</Empty.Root>
