<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";

export let href: string;
export let label: string;
export let visible = true;
</script>

{#if visible}
  <Card.Footer class="justify-end border-t pt-3">
    <Button href={href} size="sm" variant="ghost">{label}</Button>
  </Card.Footer>
{/if}
