<script lang="ts">
import type { Snippet } from "svelte";
import { Button } from "#lib/components/ui/button/index.js";

let { cancelLabel, onCancel, cancelDisabled, class: className, children }: {
  cancelLabel: string;
  onCancel: () => void;
  cancelDisabled?: boolean;
  class?: string;
  children: Snippet;
} = $props();
</script>

<div data-slot="dialog-footer" class={className}>
  <Button variant="outline" onclick={onCancel} disabled={cancelDisabled}>{cancelLabel}</Button>
  {@render children()}
</div>
