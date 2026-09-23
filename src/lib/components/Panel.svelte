<script lang="ts">
import type { Snippet } from "svelte";
import * as Card from "$lib/components/ui/card/index.js";
import { cn } from "$lib/utils.js";

type Props = {
  children: Snippet;
  class?: string;
  footer?: Snippet;
  header?: Snippet;
};

let { children, class: className = "", footer, header }: Props = $props();
</script>

<Card.Root class={cn("min-w-0", className)}>
  {#if header}
    <Card.Header>
      {@render header()}
    </Card.Header>
  {/if}
  <Card.Content class="min-w-0">
    {@render children()}
  </Card.Content>
  {#if footer}
    <Card.Footer class="justify-center">
      {@render footer()}
    </Card.Footer>
  {/if}
</Card.Root>
