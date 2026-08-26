<script lang="ts">
import type { Snippet } from "svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import { cn } from "$lib/utils.js";

type Props = {
  children: Snippet;
  class?: string;
  description?: string;
  title: string;
};

let {
  children,
  class: className = "",
  description = "",
  title,
}: Props = $props();
</script>

<section
  class={cn("flex min-w-0 flex-col gap-5", className)}
  data-slot="page-layout"
>
  <PageHeader {description} {title} />
  <div class="min-w-0" data-slot="page-layout-content">
    {@render children()}
  </div>
</section>
