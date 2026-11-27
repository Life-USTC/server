<script lang="ts">
import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";
import type { Snippet } from "svelte";
import * as DropdownMenu from "#lib/components/ui/dropdown-menu/index.js";

let {
  label,
  children,
  ...button
}: {
  label: string;
  children: Snippet;
  disabled?: boolean;
  title?: string | null;
  "data-testid"?: string;
} = $props();
</script>

<DropdownMenu.Root>
  <DropdownMenu.ButtonTrigger {...button} icon={MoreHorizontal} aria-label={label} class="icon-action" size="icon" type="button" variant="outline" />
  <DropdownMenu.Content align="end">{@render children()}</DropdownMenu.Content>
</DropdownMenu.Root>
