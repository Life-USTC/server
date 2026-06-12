<script lang="ts">
import AppShell from "$lib/components/shell/AppShell.svelte";
import "./svelte.css";
import type { LayoutData } from "./$types";

export let data: LayoutData;
</script>

<svelte:head>
  <title>Life@USTC</title>
  <meta
    name="description"
    content={data.copy.description}
  />
</svelte:head>

<AppShell {data}>
  <slot />
</AppShell>
