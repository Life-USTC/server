<script lang="ts">
import type { ComponentProps } from "svelte";
import Description from "./alert-description.svelte";
import Title from "./alert-title.svelte";
import Root from "./alert.svelte";

let { children, heading, ...props }: Omit<ComponentProps<typeof Root>, "ref"> & {
  heading?: string;
} = $props();
</script>

<Root {...props}>
  {#if heading !== undefined}<Title>{heading}</Title>{/if}
  <Description>{@render children?.()}</Description>
</Root>
