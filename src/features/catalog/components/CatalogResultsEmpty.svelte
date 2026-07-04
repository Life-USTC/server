<script lang="ts">
import * as Empty from "$lib/components/ui/empty/index.js";

export let centered = false;
export let description: string;
export let title: string;
</script>

<Empty.Root
  class={centered
    ? "border border-border bg-background"
    : "items-start border border-border bg-background text-left"}
>
  <Empty.Header class={centered ? "" : "items-start text-left"}>
    <Empty.Title>{title}</Empty.Title>
    <Empty.Description>{description}</Empty.Description>
  </Empty.Header>
</Empty.Root>
