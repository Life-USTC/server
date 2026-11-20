<script lang="ts">
import type { Snippet } from "svelte";
import { page } from "$app/state";
import { activeDetailTab, type DetailTab } from "./detail-navigation";

let {
  tab,
  children,
  class: className,
}: {
  tab: DetailTab;
  children: Snippet;
  class?: string;
} = $props();

const active = $derived(
  activeDetailTab(page.data.shellDetail, page.url) === tab,
);
</script>

<section id={tab} class={className} hidden={!active} data-detail-tab={tab}>
  {@render children()}
</section>
