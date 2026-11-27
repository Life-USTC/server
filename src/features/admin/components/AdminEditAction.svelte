<script lang="ts">
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import SquarePen from "@lucide/svelte/icons/square-pen";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import TableRowActions from "#lib/components/TableRowActions.svelte";
import { Button } from "#lib/components/ui/button/index.js";

let {
  label,
  onclick,
  layout,
}: {
  label: string;
  onclick: () => void;
  layout: "card" | "table";
} = $props();
</script>

{#if layout === "card"}
  <Button size="sm" variant="ghost" {onclick}>
    {label}
    <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
  </Button>
{:else}
  <TableRowActions>
    <TableIconButton {label} {onclick} icon={SquarePen} />
  </TableRowActions>
{/if}
