<script lang="ts">
import { Button } from "#lib/components/ui/button/index.js";

let {
  applyLabel,
  resetLabel,
  onreset,
  disabled = false,
  form,
}: {
  applyLabel: string;
  resetLabel: string;
  onreset: () => void;
  disabled?: boolean;
  form?: string;
} = $props();
</script>

<div class="compact-toolbar flex flex-wrap items-center gap-2" data-slot="filter-actions">
  <Button type="submit" {form} {disabled}>{applyLabel}</Button>
  <Button variant="outline" {disabled} onclick={onreset}>{resetLabel}</Button>
</div>
