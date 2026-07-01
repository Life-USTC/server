<script lang="ts">
import * as Empty from "$lib/components/ui/empty/index.js";

export let centered = false;
export let description: string;
export let title: string;
</script>

<Empty.Root
  class={centered
    ? "border border-base-300 bg-base-100"
    : "items-start border border-base-300 bg-base-100 text-left"}
>
  <Empty.Header class={centered ? "" : "items-start text-left"}>
    <Empty.Title>{title}</Empty.Title>
    <Empty.Description>{description}</Empty.Description>
  </Empty.Header>
</Empty.Root>
